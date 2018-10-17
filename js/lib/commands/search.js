'use strict'

/* eslint-disable camelcase */

import request from 'request-promise-native'
import { searchURL, pageSummaryURL, WIKIPEDIA_BASE_URL } from './helpers/endpoints'
import headers from './helpers/request-headers'
import { articleCallbackID, attachments, message, ResponseType } from './helpers/message-defaults'
import { respondImmediatelyToAvoidTimeOut, respondSafely } from './helpers/safe-response'
import { saveMessageAttachments } from './helpers/saving-message-attachments'

const getTitle = (match) => new Promise((resolve, reject) => {
    const options = {
        uri: searchURL(match),
        json: true,
        headers
    }

    request(options).then((object) => {
        const [page] = object.query.prefixsearch
        const title = page.title

        resolve(title)
    }).
    
        catch((err) => {
            reject(err)
        })
})

const getArticle = (title) => new Promise((resolve, reject) => {
    const options = {
        uri: pageSummaryURL(title),
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
    respondImmediatelyToAvoidTimeOut(response)

    const regex = /search\s(.*)/
    const [, match] = regex.exec(payload.text)
    const responseURL = payload.response_url

    getTitle.then((title) => {
        getArticle(title).then((article) => {
            const pretext = '🔍'
            const color = '#3366cc'

            const articleID = article.pageid

            const commandCallbackID = payload.text
    
            const key = articleCallbackID(commandCallbackID, articleID)
            const messageAttachments = attachments(article, pretext, color, key)
            const responseMessage = message(ResponseType.EPHEMERAL, messageAttachments.withActions)
    
            saveMessageAttachments(key, messageAttachments.withoutActions)      
            respondSafely(responseURL, responseMessage)
        }).

            catch((err) => {
                console.log(err)
                respondWithPageNotFound(responseURL, match)
            })

    }).
        catch((err) => {
            console.log(err)
            respondWithPageNotFound(responseURL, match)
        })
  
}

const respondWithPageNotFound = (responseURL, match) => {

    const attachments = [
        {
            pretext: `There's no Wikipedia page for ${match} 🧐`,
            title: 'Learn how to create Wikipedia pages',
            title_link: 'https://en.wikipedia.org/wiki/Wikipedia:How_to_create_a_page',
            color: '#33cc99'
        },
        {
            title: `Create a page for ${match}`,
            title_link: `${WIKIPEDIA_BASE_URL}wiki/${match}`,
            color: '#3366cc'
        }
    ]

    const responseMessage = message(ResponseType.EPHEMERAL, attachments)

    respondSafely(responseURL, responseMessage)
}

export default {
    pattern: /search\s/ig,
    handler
}