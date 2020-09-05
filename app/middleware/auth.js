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
        
        const {user_id, major_id} = ctx.request.query

        ctx.auth = {user_id, major_id};

        await next();
    }
}