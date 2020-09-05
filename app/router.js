'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);
  router.get('/cat', controller.home.cat);
  router.get('/conf', controller.home.conf);
  router.get('/subject', controller.home.subject);

  router.post('/in_game', controller.game.inGame)

  app.ws.use(async (ctx, next) => {
    // 获取参数 ws://localhost:7001/ws?token=123456
    // ctx.query.token
    // 验证用户token
    let user = {};
    let token = ctx.query.token;
    user.id = token;
    try {
      // 用户上线 
      app.ws.user = app.ws.user ? app.ws.user : {};
      // 记录当前用户id
      ctx.websocket.user_id = user.id;
      app.ws.user[user.id] = ctx.websocket;

      await next();
    } catch (err) {
      console.log(err);
      let fail = err.name === 'TokenExpiredError' ? 'token 已过期! 请重新获取令牌' : 'Token 令牌不合法!';
      ctx.websocket.send(JSON.stringify({
        type: 'system',
        msg: fail
      }))
      // 关闭连接
      ctx.websocket.close();
    }
  });
  app.ws.route('/ws', controller.chat.conn);

};
