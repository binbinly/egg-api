'use strict';

const Controller = require('./base');

class HomeController extends Controller {

  async index() {
    this.ctx.body = 'hello'
    
    let a = {master:{user_id:10}, slave:{user_id:9}}
    console.log(a)
    console.log(Object.keys(a).length)
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

  async subject() {
    const ctx = this.ctx;
    const list = await ctx.model.Subject.getAll(1, 5);
    this.success(list)
  }
}

module.exports = HomeController;
