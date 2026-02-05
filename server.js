'use strict';
const PORT = "5098" // 5025

const start = async ()=>{
    try {
        const fastify = require('./app');
        await fastify.listen({port : PORT})
        console.log(`App Listening On Port : ${PORT}`)
    } catch (error) {
        // fastify.log.error(error)
        console.log(error)
        process.exit(1)
    }
}

start()