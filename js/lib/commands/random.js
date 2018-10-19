'use strict'

/* eslint-disable camelcase */

import request from 'request-promise-native'
import { RANDOM_URL } from './helpers/endpoints'
import headers from './helpers/request-headers'
import { articleKey, attachments, message, ResponseType } from './helpers/message-defaults'
import { save } from './helpers/cache'
import { respondImmediately, respondWithDelay } from './helpers/safe-response';

const getRandomArticle = new Promise((resolve, reject) => {
    const options = {
        uri: RANDOM_URL,
        json: true,
        headers
    }

    request(options).then((object) => {
        resolve(object)
    }).
    
        catch((err) => {
            reject(err)
        })
})

const handler = (payload, response) => {
    getRandomArticle.then((article) => {
        const pretext = '🎲'
        const color = '#3366cc'
    respondImmediately(response)

        const articleID = article.pageid

        const command = payload.text
        const responseURL = payload.response_url

        const key = articleKey(command, articleID)
        const messageAttachments = attachments(article, pretext, color, key)
        const responseMessage = message(ResponseType.EPHEMERAL, messageAttachments.withActions)
        
        save(key, messageAttachments.withoutActions)
        respondWithDelay(responseURL, responseMessage)
    })

}

export default {
    pattern: /random/ig,
    handler
}