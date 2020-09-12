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
    app.major = []
    app.room = []
    app.group_room = []

    const async = require('async');
    //个人赛进入房间
    this.app.queue_game_in = async.queue(function (obj, callback) {
      console.log('queue game in', obj)
      setTimeout(async () => {
        console.log('settimeout')
        const { major_id, id } = obj;
        const count = await app.redis.scard('game_major_' + major_id);
        console.log('count', count)
        if (count >= 3) {//大于等于3可以开始游戏
          await ctx.service.game.gameStart(major_id, id, 'end');
        }
        if (typeof callback === 'function') {
          callback();
        }
      }, 60000);
    }, 5);

    //个人赛推送题目
    this.app.queue_game_run = async.queue(function (obj, callback) {
      console.log('queue game run', obj)
      const { room_name, user_ids, time } = obj
      setTimeout(async () => {
        console.log('timeout')
        await ctx.service.game.nextSubject(room_name, user_ids, 'end')
        if (typeof callback === 'function') {
          callback();
        }
      }, 8000);
    }, 5)

    //团队赛，准备队列
    this.app.queue_group_ready = async.queue(function (obj, callback) {
      console.log('group ready', obj)
      const { room_name, r, b, time } = obj
      setTimeout(async () => {
        console.log('timeout ready')
        await ctx.service.group.rushAnswer(room_name, r, b)
        if (typeof callback === 'function') {
          callback();
        }
      }, time);
    }, 5)

    //团队赛 枪替队列
    this.app.queue_group_rush = async.queue(function (obj, callback) {
      console.log('group rush', obj)
      const { room_name, r, b, time } = obj
      setTimeout(async () => {
        console.log('timeout rush')
        await ctx.service.group.nextSubject(room_name, r, b, 'end')
        if (typeof callback === 'function') {
          callback();
        }
      }, time);
    }, 5)

    //团队赛 推送题目
    this.app.queue_group_run = async.queue(function (obj, callback) {
      console.log('group run', obj)
      const { room_name, r, b, time } = obj
      setTimeout(async () => {
        console.log('timeout run')
        await ctx.service.group.ready(room_name, r, b, 'end')
        if (typeof callback === 'function') {
          callback();
        }
      }, time);
    }, 5)

    this.app.queue_test = async.queue(function (obj, callback) {
      console.log('queue test start', new Date().getTime() / 1000)
      app.queue_key = setTimeout(() => {
        console.log('time', new Date().getTime() / 1000)
      }, 5000);
      if (typeof callback === 'function') {
        callback();
      }
    }, 1)
  }

  async serverDidReady() {
    // http / https server 已启动，开始接受外部请求
    // 此时可以从 app.server 拿到 server 的实例
  }
}

module.exports = AppBootHook;
