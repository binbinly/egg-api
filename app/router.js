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
  router.post('/login', controller.home.login)

  router.post('/in_game', controller.game.inGame)
  router.get('/out_game', controller.game.outGame)
  router.post('/game_answer', controller.game.answer)
  router.post('/game_message', controller.game.message)

  router.get('/group/in_game', controller.group.inGame)
  router.get('/group/out_game', controller.group.outGame)
  router.post('/group/invite', controller.group.invite)
  router.post('/group/invite_do', controller.group.inviteDo)
  router.post('/group/kick', controller.group.gameKick)
  router.post('/group/match', controller.group.gameMatch)

  router.get('/group/rush', controller.group.rush)  //抢题
  router.post('/group/answer', controller.group.answer) 

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

      ctx.online(user.id);
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
