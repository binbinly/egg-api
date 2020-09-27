'use strict';

const Controller = require('egg').Controller;

/**
 * websocket
 */
class ChatController extends Controller {
    async conn() {
        const { ctx, app, service } = this;
        if (!ctx.websocket) {
            ctx.throw(500, 'this function can only be use in websocket router');
        }

        ctx.websocket
            .on('message', async (msg) => {
                if (msg === 'ping') {
                    ctx.websocket.send('pong');
                } else {
                    const data = JSON.parse(msg)
                    if (!data) {
                        ctx.websocket.send('err')
                        return
                    }
                    //获取房间信息
                    if (data.cmd == 'user_room_info') {
                        const data = await service.game.userRoomInfo(ctx.websocket.user_id)
                        if (data == false) {
                            ctx.websocket.send(JSON.stringify({cmd:'user_room_info_do', code:500, msg:'房间已解散'}))
                        } else {
                            ctx.websocket.send(JSON.stringify({cmd:'user_room_info_do', code:200, data}))
                        }
                    }
                }
            })
            .on('close', (code, reason) => {
                let user_id = ctx.websocket.user_id;
                service.cache.remove('online_' + user_id);
                if (app.ws.user[user_id]) {
                    delete app.ws.user[user_id];
                }
            });
    }
}

module.exports = ChatController;
