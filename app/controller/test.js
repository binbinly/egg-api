'use strict';

const Controller = require('egg').Controller;

class TestController extends Controller {

    async err(){
        console.log(a)
    }

    async rush() {
        this.ctx.body = 'hello'
        let {env, t} = this.ctx.request.query
        let host = 'http://127.0.0.1:7001/'
        if (env == 'online') {
            host = 'http://api.lifetrifles.com/'
        }
        if (!t) {
            t = 1
        }

        //进入房间
        for (let i = 1; i<=6; i++){
            const in_game = 'group/in_game?user_id='+ i +'&major_id=1'
            const result = await this.get(host, in_game)
            console.log(result.data)
        }
        //开始匹配
        for (let i = 1; i<=6; i++){
            const match = 'group/match?user_id='+ i +'&major_id=1'
            const result = await this.post(host, match, {id:1, type:t, act:1})
            console.log(result.data)
        }
    }

    async post(host, path, data) {
        const {app, ctx} = this
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
        const {app, ctx} = this
        const result = await app.curl(host + path, {
            dataType: 'json',
        });
        return result
    }
}

module.exports = TestController;
