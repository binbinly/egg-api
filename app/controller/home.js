'use strict';

const Controller = require('./base');

class HomeController extends Controller {

  async index() {
    this.ctx.body = 'hello'
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

  async subject(){
    const ctx = this.ctx;
    const list = await ctx.model.Subject.getAll(1, 5);
    this.success(list)
  }
}

module.exports = HomeController;
