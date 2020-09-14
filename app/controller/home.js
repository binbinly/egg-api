'use strict';

const Controller = require('./base');

class HomeController extends Controller {

  async index() {
    this.ctx.body = 'hello'

    var arr = ["太阳光大", "成功是优点的发挥", "不要小看自己", "口说好话", "手心向下是助人"];
    this.ctx.body = arr[Math.floor((Math.random() * arr.length))]
    console.log(new Date().getTime())
    this.app.redis.setex('a', 70, new Date().getTime())
    // this.app.queue_test.push({}, function (err) {
    //   console.log(err)
    //   console.log('finished processing foo');
    // });
  }

  async conf() {
    const { ctx } = this;
    const list = await ctx.model.Config.getAll();
    this.success(list)
  }

  async cat() {
    const ctx = this.ctx;
    const list = await ctx.model.Cat.getAll();
    this.success(list)
  }

  async login() {
    this.success({ user_i1: 1, major_id: 1, username: 'test', avatar: '' });
  }

  async subject() {
    const ctx = this.ctx;
    const list = await ctx.model.Subject.getAll(1, 5);
    this.success(list)
  }
}

module.exports = HomeController;
