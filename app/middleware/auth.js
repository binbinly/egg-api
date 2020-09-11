module.exports = (option, app) => {
    return async (ctx, next) => {
        // let token = ctx.header.token || ctx.query.token;
        // if (!token) {
        //     ctx.throw(400, '您没有权限访问该接口');
        // }
        // let user = {};
        // let t = await ctx.service.cache.get('user_' + user.id);
        // if (!t || t !== token) {
        //     ctx.throw(400, 'token 令牌不合法')
        // }
        
        let {user_id, major_id} = ctx.request.query
        user_id = parseInt(user_id)
        major_id = parseInt(major_id)

        ctx.auth = {user_id, major_id, username:'test_' + user_id, avatar:'http://www.baidu.com'};

        await next();
    }
}