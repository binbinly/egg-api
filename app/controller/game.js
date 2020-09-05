'use strict';

const Controller = require('./base');

class GameController extends Controller {

    /**
     * 进入单人游戏
     */
    async inGame() {
        const { ctx, app, service } = this;
        // 拿到当前用户id
        const user_id = ctx.auth.user_id;
        const major_id = ctx.auth.major_id;
        console.log('body', ctx.request.body)
        // 验证参数
        ctx.validate({
            id: { type: 'int', required: true }
        });
        //专业id
        const { id } = ctx.request.body;

        //当前专业人数
        let curr_major_count = await app.redis.scard('game_major_' + major_id);

        const ret = await app.redis.sadd('game_major_' + major_id, user_id);
        if (!ret) {
            return this.error(500, '进入失败')
        }
        
        if (curr_major_count === 0) {
            await app.redis.expire('game_major_' + major_id, 60)
            app.current_major_id = major_id;
            app.current_id = id;
            await app.runSchedule('game_start');
        } else if (curr_major_count >= 6) {
            const user_ids = await app.redis.smembers('game_major_'+major_id)
            console.log(user_ids)
            await service.game.gameStart(user_ids, id);
            await app.redis.del('game_major_'+major_id)
        }
        
        this.success()
    }
}

module.exports = GameController;
