'use strict';

const Service = require('egg').Service;

class GameService extends Service {

    /**
     * 游戏开始
     * @param {*} user_ids 
     * @param {*} id 
     */
    async gameStart(user_ids, id) {
        const {ctx, app} = this;
        //题目列表
        const list = await ctx.model.Subject.getAll(id, 5);
        user_ids.forEach(user_id => {
            console.log('user_id', user_id)
            let ws = app.ws.user[user_id] ? app.ws.user[user_id] : null
            if (ws) {
                ws.send(JSON.stringify({cmd:'game_start', data:list}))
            }
        });
    }
}

module.exports = GameService;
