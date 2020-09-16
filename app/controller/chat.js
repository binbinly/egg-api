'use strict';

const Controller = require('egg').Controller;

class ChatController extends Controller {
    async conn() {
        const { ctx, app, service } = this;
        if (!ctx.websocket) {
            ctx.throw(500, 'this function can only be use in websocket router');
        }

        ctx.websocket
            .on('message', (msg) => {
                if (msg === 'ping') {
                    ctx.websocket.send('pong');
                }
            })
            .on('close', (code, reason) => {
                console.log('websocket closed', code, reason);
                let user_id = ctx.websocket.user_id;
                service.cache.remove('online_' + user_id);
                if (app.ws.user && app.ws.user[user_id]) {
                    delete app.ws.user[user_id];
                }
            });
    }
}

module.exports = ChatController;
