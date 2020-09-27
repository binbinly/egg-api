'use strict';

const Controller = require('egg').Controller;

/**
 * 仅测试
 */
class TestController extends Controller {

    /**
     * 个人赛测试
     */
    async in() {
        this.ctx.body = 'hello'
        const host = 'http://' + this.ctx.request.headers.host + '/'
        //进入房间
        for (let i = 1; i <= 6; i++) {
            const in_game = 'in_game?user_id=' + i + '&major_id=1'
            const result = await this.post(host, in_game, { id: 1 })
            console.log(result.data)
        }
    }

    /**
     * 团队赛测试
     */
    async rush() {
        this.ctx.body = 'hello'
        let { t } = this.ctx.request.query
        const host = 'http://' + this.ctx.request.headers.host + '/'
        if (!t) {
            t = 1
        }

        //进入房间
        for (let i = 1; i <= 6; i++) {
            const in_game = 'group/in_game?user_id=' + i + '&major_id=1'
            const result = await this.post(host, in_game, {id:1, type:1})
            console.log(result.data)
        }
        console.log('test match')
        //开始匹配
        for (let i = 1; i <= 6; i++) {
            const match = 'group/match?user_id=' + i + '&major_id=1'
            const result = await this.post(host, match, { id: 1, type: t, act: 1 })
            console.log(result.data)
        }
    }

    async post(host, path, data) {
        const { app, ctx } = this
        const result = await ctx.curl(host + path, {
            // 必须指定 method
            method: 'POST',
            // 通过 contentType 告诉 HttpClient 以 JSON 格式发送
            contentType: 'json',
            data,
            // 明确告诉 HttpClient 以 JSON 格式处理返回的响应 body
            dataType: 'json',
        });
        return result
    }

    async get(host, path) {
        const { app, ctx } = this
        const result = await app.curl(host + path, {
            dataType: 'json',
        });
        return result
    }
}

module.exports = TestController;
