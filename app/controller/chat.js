'use strict';

const Controller = require('egg').Controller;

class ChatController extends Controller {
    async conn() {
        const { ctx, app } = this;
        if (!ctx.websocket) {
            ctx.throw(500, 'this function can only be use in websocket router');
        }

        ctx.websocket
            .on('message', (msg) => {
                console.log('receive', msg);
                if (msg === 'ping') {
                    ctx.websocket.send('pong');
                }
            })
            .on('close', (code, reason) => {
                console.log('websocket closed', code, reason);
                let user_id = ctx.websocket.user_id;
                console.log(user_id)
                if (app.ws.user && app.ws.user[user_id]) {
                    delete app.ws.user[user_id];
                }
            });
    }
}

module.exports = ChatController;
