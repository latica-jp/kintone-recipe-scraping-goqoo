import cheerio from 'cheerio'
import { cleanLineBreaksFromObject, downloadDataAsBlob, uploadFile } from '../common/utils'

kintone.events.on(['app.record.index.show'], event => {
  const button = document.createElement('button')
  button.textContent = 'Fetch'
  button.type = 'button'
  button.onclick = receiveRecipe
  kintone.app.getHeaderMenuSpaceElement().appendChild(button)

  const input = document.createElement('input')
  input.type = 'text'
  input.name = 'recipe_url'
  kintone.app.getHeaderMenuSpaceElement().appendChild(input)

  return event
})

const receiveRecipe = async () => {
  const input = document.querySelector('input[name="recipe_url"]')
  const url = input.value
  if (!url) return

  const recipe = await requestRecipe(url)
  const blob = await downloadDataAsBlob(recipe.imageUrl, 'image/jpeg')
  const recipeImageFileKey = await uploadFile('file.jpeg', 'image/jpeg', blob)

  const ingredients = recipe.ingredients.map(ingredient => {
    return {
      value: {
        ingredient: { type: 'SINGLE_LINE_TEXT', value: ingredient.ingredient || ingredient.category },
        ingredientAmount: { type: 'SINGLE_LINE_TEXT', value: ingredient.amount },
      },
    }
  })

  const steps = []
  // 非同期処理を順番に実行するので for..of をつかう
  for (const step of recipe.steps) {
    let fileKey
    if (step.stepImageUrl) {
      const blob = await downloadDataAsBlob(step.stepImageUrl, 'image/jpeg')
      fileKey = await uploadFile('file.jpeg', 'image/jpeg', blob)
    }
    steps.push({
      value: {
        step: { type: 'SINGLE_LINE_TEXT', value: step.step },
        stepImage: { type: 'FILE', value: fileKey ? [{ fileKey }] : [] },
      },
    })
  }
  const record = {
    recipeImage: { type: 'FILE', value: recipeImageFileKey ? [{ fileKey: recipeImageFileKey }] : [] },
    recipeUrl: { value: url },
    recipeName: { value: recipe.name },
    ingredients: { value: ingredients },
    steps: { value: steps },
  }

  const response = await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', {
    app: kintone.app.getId(),
    record,
  })

  // 作成されたレコードの詳細画面に遷移
  const location = window.location.href.split('?')[0]
  window.location.href = `${location}show#record=${response.id}`
}

const requestRecipe = async url => {
  console.warn({ url })
  try {
    const contents = await kintone.proxy(url, 'GET', {}, {})
    console.warn({ contents })
    return parseRecipe(contents[0])
  } catch (error) {
    console.error(error)
    throw new Error(error)
  }
}

const parseRecipe = contents => {
  const $ = cheerio.load(contents)

  const name = $('h1.recipe-title').text()
  const imageUrl = $('#main-photo img').attr('data-large-photo')

  const ingredients = []
  $('div#ingredients_list div.ingredient').each((index, element) => {
    if ($(element).find('div.ingredient_name').length > 0) {
      ingredients.push({
        ingredient: $(element)
          .find('span.name')
          .first()
          .text(),
        amount: $(element)
          .find('div.ingredient_quantity')
          .first()
          .text(),
      })
    } else {
      const category = $(element)
        .find('div.ingredient_category')
        .first()
      ingredients.push({
        category: $(category).text(),
      })
    }
  })

  const steps = []
  $('div#steps div[class^="step"]').each((index, element) => {
    const step = $(element)
      .find('p.step_text')
      .first()
      .text()
    const stepImageUrl = $(element)
      .find('img')
      .first()
      .attr('data-large-photo')
    steps.push({ step, stepImageUrl })
  })

  const recipe = cleanLineBreaksFromObject({ name, imageUrl, ingredients, steps })
  return recipe
}
