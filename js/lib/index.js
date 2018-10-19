'use strict'

/* eslint-disable camelcase */

import express from 'express'
import { json, urlencoded } from 'body-parser'
import commands from './commands'
import helpCommand from './commands/help'
import config from '../config'
import request from 'request-promise-native'
import redis from 'redis'
import { redisKey, expiryTimeInHours } from './commands/helpers/cache'
import { ResponseType, message } from './commands/helpers/message-defaults'
import { respondWithDelay } from './commands/helpers/safe-response'

export let app = express()

export let redisClient = redis.createClient({ host: config.redis_host })
export let redisPrefix = config.redis_prefix

app.use(json())
app.use(urlencoded({ extended: true }))
app.set('trust proxy', true)

let port = process.env.PORT || 4390

app.listen(port, (err) => {
    if (err) {
        throw err
    } else {
        console.info(`\n🤩  Wikipedia bot LIVES on PORT ${port} 🤩`)
    }
})

export let path = `/${config.toolname}`

// Authentication

let landingPagePath = 'https://nambatee.github.io/wikipedia-slackbot/'

app.get(`${path}/auth`, (req, res) => {
    const code = req.query.code

    if (!code) {
        res.redirect(landingPagePath)
        res.status(401).end()

        return
    }

    const client_id = config.client_id
    const client_secret = config.client_secret

    if (!client_id) {
        res.redirect(landingPagePath)
        res.status(400).end('Undefined client id')

        return
    }

    if (!client_secret) {
        res.redirect(landingPagePath)
        res.status(400).end('Undefined client secret')

        return
    }

    let data = {
        client_id,
        client_secret,
        code
    }

    let options = {
        method: 'POST',
        uri: 'https://slack.com/api/oauth.access',
        formData: data
    }

    request(options).then(() => {
        res.redirect(`${landingPagePath}success.html`)
        res.status(200).end()
    }).

        catch((err) => {
            console.log(err)
            res.status(400).end(err)
        })

})

// Commands

app.post(path, (req, res) => {
    let payload = req.body

    if (!payload || !payload.token) {
        let err = `✋ Wiki—what? An invalid slash token was provided.
        Is your Slack slash token correctly configured?`

        console.log(err)
        res.status(401).end(err)
    }

    const reducer = (acc, cmd) => (payload.text.match(cmd.pattern) ? cmd : acc) // eslint-disable-line no-extra-parens
    
    const command = commands.reduce(reducer, helpCommand)
    
    command.handler(payload, res)
})

// Message actions

app.post(`${path}/message-action`, (req, res) => {
    let payload = JSON.parse(req.body.payload)
    let [action] = payload.actions

    // Respond with 200 right away to avoid timeout
    res.status(200).end()

    let callbackID = payload.callback_id
    let responseURL = payload.response_url
    let key = redisKey(callbackID)
    
    if (action.value === 'send') {
        redisClient.get(key, (err, attachments) => {
            if (err) {
                console.log(err)
    
                return
            }
            
            if (attachments === null) {
                let errorAttachments = {
                    pretext: `This message is not available anymore. Messages that you don't act upon within ${expiryTimeInHours} hours of posting expire automatically. Next time, hit 'Submit' right away.` 
                }

                let responseMessage = message(ResponseType.EPHEMERAL, errorAttachments)
    
                respondAndDeleteRedisKey(responseURL, responseMessage, key)
            } else {
                let parsedAttachments = [JSON.parse(attachments)]
                let responseMessage = message(ResponseType.IN_CHANNEL, parsedAttachments)

                responseMessage.delete_original = true
                
                respondAndDeleteRedisKey(responseURL, responseMessage, key)
            }
        })
    } else {
        let attachments = {
            delete_original: true
        }
    
        respondAndDeleteRedisKey(responseURL, attachments, key)
    }
})

function respondAndDeleteRedisKey(responseURL, responseMessage, key) {
    respondWithDelay(responseURL, responseMessage)
    redisClient.del(key)
}