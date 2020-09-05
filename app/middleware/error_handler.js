module.exports = (option, app) => {
    return async function errorHandler(ctx, next) {
        try {
            await next();

            if (ctx.status === 404 && !ctx.body) {
                ctx.body = {
                    msg: 'fail',
                    data: '404错误'
                }
            }
        } catch (err) {
            const status = err.status || 500;
            let error = status === 500 && app.config.env === 'prod'
                ? 'Internal server error' : err.message;
            // 参数验证异常
            if (status === 422) {
                console.log(err)
                ctx.body = {
                    msg: err.errors[0].message ? err.errors[0].message : err.message
                };
            } else {
                // 所有的异常都在 app 上触发一个 error 事件，框架会记录一条错误日志
                app.emit('error', err, ctx);

                ctx.body = {
                    code: status,
                    msg: 'fail',
                    data: error
                };
            }
            ctx.status = 200;
        }
    }
}