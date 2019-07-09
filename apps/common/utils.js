const axios = require('axios')
const qs = require('qs')

export const getFieldIdFromFieldCode = fieldCode => {
  const field = Object.values(cybozu.data.page.FORM_DATA.schema.table.fieldList).find(field => field.var === fieldCode)
  return field.id
}

export const getElementFromFieldCode = fieldCode => {
  const fieldId = getFieldIdFromFieldCode(fieldCode)
  return document.querySelector(`div.field-${fieldId}`)
}

export const cleanLineBreaksFromObject = obj => {
  return JSON.parse(JSON.stringify(obj).replace(/\\n/g, ''))
}

/**
 * https://developer.cybozu.io/hc/ja/articles/201941824
 * https://qiita.com/rex0220/items/ba644c916ff2c46fdd48
 */
export const uploadFile = (fileName, contentType, blob) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('__REQUEST_TOKEN__', kintone.getRequestToken())
    formData.append('file', blob, fileName)
    const url = kintone.api.url('/k/v1/file', true)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
    xhr.onload = () => {
      if (xhr.status === 200) {
        // successful
        const results = JSON.parse(xhr.response)
        resolve(results['fileKey'])
      } else {
        // fails
        reject(Error('File upload error:' + xhr.statusText))
      }
    }
    xhr.onerror = () => {
      reject(Error('There was a network error.'))
    }
    xhr.send(formData)
  })
}

export const downloadDataAsBlob = async (url, contentType) => {
  try {
    const queryStr = qs.stringify({ url }, { addQueryPrefix: true })
    const response = await axios.get(`https://pipe-with-cors.latica.now.sh/${queryStr}`, {
      responseType: 'blob',
      dataType: 'binary',
    })
    return new Blob([response.data], { type: contentType })
  } catch (error) {
    console.error(error)
    throw new Error(error)
  }
}
