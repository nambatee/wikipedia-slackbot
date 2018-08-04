'use strict'

/* eslint-disable camelcase */

import request from 'request-promise-native'
import { feed } from './helpers/endpoints'
import message from '../message-defaults'

const handler = (payload, response) => {

    let options = {
        uri: feed.FEATURED,
        json: true
    }

    request(options).then((object) => {

        respond(payload, response, object) 

    }).
        catch((err) => {
            console.log(err)
        })
  
}

const respond = (payload, response, object) => {
    let articles = object.mostread.articles
    let [article] = articles
    let title = article.displaytitle
    let title_link = article.content_urls.desktop.page
    let text = article.extract

    let attachments = [
        {
            pretext: 'Top read today 📈',
            title,
            title_link,
            text,
            color: '#3366cc'
        }
    ]

    response.set('content-type', 'application/json')
    response.status(200).json(message(payload, attachments))  
}

export default {
    pattern: /top\sread/ig,
    handler
}