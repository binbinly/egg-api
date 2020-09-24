class AppBootHook {
  constructor(app) {
    this.app = app;
  }

  configWillLoad() {
    // 此时 config 文件已经被读取并合并，但是还并未生效
    // 这是应用层修改配置的最后时机
    // 注意：此函数只支持同步调用
  }

  async didLoad() {
    // 所有的配置已经加载完毕
    // 可以用来加载应用自定义的文件，启动自定义的服务
  }

  async willReady() {
    // 所有的插件都已启动完毕，但是应用整体还未 ready
    // 可以做一些数据初始化等操作，这些操作成功才会启动应用
    // 例如：从数据库加载数据到内存缓存
  }

  async didReady() {
    // 应用已经启动完毕
    const app = this.app;
    const ctx = await app.createAnonymousContext();

    //初始化在线用户
    app.ws.user = {}

    app.messenger.on("offline", (user_id) => {
      if (app.ws.user[user_id]) {
        app.ws.user[user_id].send(JSON.stringify({ cmd: "offline", data: "你的账号在其他设备登录" }));
        app.ws.user[user_id].close();
      }
    });

    app.messenger.on("send", (e) => {
      let { to_id, cmd, data } = e;
      if (app.ws.user[to_id]) {
        app.ws.user[to_id].send(JSON.stringify({ cmd, data }));
      }
    });

    const async = require('async');
    const concurrent = 4 //并发

    //个人赛进入房间
    app.queue_game_in = async.queue(function (obj, callback) {
      console.log('queue game in')
      const start_time = new Date().getTime()
      setTimeout(async () => {
        console.log('settimeout')
        const { major_id, id } = obj;
        const end_time = new Date().getTime()
        const run_time = await app.redis.get('start_major_' + major_id + '_' + id)
        if (run_time > start_time && run_time < end_time) {
          console.log('skip')
        } else {
          const count = await app.redis.scard('game_major_' + major_id);
          if (count >= 3) {//大于等于3可以开始游戏
            await ctx.service.game.gameStart(major_id, id);
          } else if (count >= 1) {
            await ctx.service.game.gameStop(major_id);
          }
        }
        if (typeof callback === 'function') {
          callback();
        }
      }, 60000);
    }, concurrent);

    //个人赛推送题目
    app.queue_game_run = async.queue(function (obj, callback) {
      console.log('queue game run')
      const { subject, room_name, user_ids, time } = obj
      setTimeout(async () => {
        console.log('timeout')
        const is = await app.redis.hexists('room_' + room_name, subject['id'])
        if (!is) {
          await ctx.service.game.nextSubject(room_name, user_ids)
        } else {
          console.log('skip')
        }
        if (typeof callback === 'function') {
          callback();
        }
      }, time * 1000);
    }, concurrent)

    //团队赛，准备队列
    app.queue_group_ready = async.queue(function (obj, callback) {
      console.log('group ready')
      const { subject, room_name, r, b, time } = obj
      setTimeout(async () => {
        console.log('timeout ready')
        await ctx.service.group.rushAnswer(subject, room_name, r, b)
        if (typeof callback === 'function') {
          callback();
        }
      }, time * 1000);
    }, concurrent)

    //团队赛 枪题队列
    app.queue_group_rush = async.queue(function (obj, callback) {
      console.log('group rush')
      const { subject, room_name, r, b, time } = obj
      setTimeout(async () => {
        console.log('timeout rush')
        await ctx.service.group.pushSubject(subject, room_name, r, b)
        if (typeof callback === 'function') {
          callback();
        }
      }, time * 1000);
    }, concurrent)

    //团队赛 推送题目
    app.queue_group_run = async.queue(function (obj, callback) {
      console.log('group run')
      const { subject, room_name, r, b, time } = obj
      setTimeout(async () => {
        console.log('timeout run')
        const is = await app.redis.hexists('group_room_' + room_name, subject['id'])
        if (!is) {
          await ctx.service.group.ready(room_name, r, b)
        } else {
          console.log('skip')
        }
        if (typeof callback === 'function') {
          callback();
        }
      }, time * 1000);
      //是否切换答题方
      setTimeout(async () => {
        console.log('timeout switch')
        const is = await app.redis.hexists('group_room_' + room_name, subject['id'])
        if (!is) {
          await ctx.service.group.switch(subject['id'], room_name, r, b)
        } else {
          console.log('skip')
        }
      }, time * 1000 / 2);
    }, concurrent)

    //团队赛 出题模式 - 选题
    app.queue_group_set_choice = async.queue(function (obj, callback) {
      console.log('group choice')
      const { room_name, r, b, time } = obj
      setTimeout(async () => {
        await ctx.service.question.push(room_name, r, b)
        if (typeof callback === 'function') {
          callback();
        }
      }, time * 1000);
    }, concurrent)

    //团队赛 出题模式 - 答题
    app.queue_group_set_answer = async.queue(function (obj, callback) {
      console.log('group answer')
      const { round, room_name, r, b, time } = obj
      setTimeout(async () => {
        const is = await app.redis.hexists('group_room_' + room_name, 'round_' + round)
        console.log('round', round)
        if (!is){
          await ctx.service.question.choice(room_name, r, b)
        } else {
          console.log('skip')
        }
        
        if (typeof callback === 'function') {
          callback();
        }
      }, time * 1000);
    }, concurrent)
  }

  async serverDidReady() {
    // http / https server 已启动，开始接受外部请求
    // 此时可以从 app.server 拿到 server 的实例
  }
}

module.exports = AppBootHook;
