module.exports = {
    schedule: {
        interval: '10m', // 1 分钟间隔
        type: 'all', // 指定所有的 worker 都需要执行
    },
    async task(ctx) {
        console.log('game start')
        major_id = ctx.app.current_major_id
        id = ctx.app.current_id
        ctx.app.current_major_id = 0;
        ctx.app.current_id = 0;
        if (major_id > 0 && id > 0) {
            setTimeout(async () => {
                console.log('settimeout')
                const count = await ctx.app.redis.scard('game_major_' + major_id);
                if (count >= 3) {
                    const user_ids = await ctx.app.redis.smembers('game_major_'+major_id)
                    console.log(user_ids)
                    await ctx.service.game.gameStart(user_ids, id);
                    await ctx.app.redis.del('game_major_'+major_id)
                }
            }, 10000);
        }
    },
};