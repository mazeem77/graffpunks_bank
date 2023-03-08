'use strict';

const InlineKeyboardButton = require('../models/InlineKeyboardButton');
const InlineKeyboardMarkup = require('../models/InlineKeyboardMarkup');
const ReplyKeyboardMarkup = require('../models/ReplyKeyboardMarkup');
const KeyboardButton = require('../models/KeyboardButton');
const { chunk } = require('lodash');

class Scope {
  /**
   *
   * @param {Update} update
   * @param {TelegramApi} api
   * @param {BaseScopeExtension[]} extensions
   * @param {Object} waitingRequests
   * @param {Object} waitingCallbackQueries
   * @param {BaseLogger} logger
   * @param {Function} processUpdate
   * @param {TelegramSessionStorage} sessionStorage
   * @param {Function} waitForUpdate
   * @param {Function} waitForCallback
   */
  constructor(
    update,
    params,
    api,
    extensions,
    files,
    waitingRequests,
    waitingCallbackQueries,
    logger,
    sessionStorage
    // waitForUpdate,
    // waitForCallback
  ) {
    this._api = api;
    this._update = update;
    this._updateParams = params;
    /**
     *
     * @type {BaseScopeExtension[]}
     * @private
     */
    this._extensions = extensions;
    this._files = files;
    this._waitingRequests = waitingRequests;
    this._waitingCallbackQueries = waitingCallbackQueries;

    this._isEditedMessage = !!update.editedMessage;

    this._message = update.message || update.editedMessage;
    this._chatId = this._message.chat.id;
    this._userId = this._message.from.id;
    this._fromGroupChat = !(this._userId === this._chatId);

    this._logger = logger;
    this._sessionStorage = sessionStorage;
    // this._waitForUpdate = waitForUpdate
    // this._waitForCallback = waitForCallback

    this._extensions.forEach(extension => {
      const extensionInstance = new extension(this);
      this[extensionInstance.name] = extensionInstance.process;
    });
  }

  /**
   * @returns {TelegramSessionStorage}
   */
  get sessionStorage() {
    return this._sessionStorage;
  }

  /**
   * @returns {BaseStorage}
   */
  get storage() {
    return this._sessionStorage;
  }

  /**
   *
   * @returns {Update}
   */
  get update() {
    return this._update;
  }

  /**
   *
   * @returns {Object}
   */
  get updateParams() {
    return this._updateParams;
  }

  /**
   *
   * @returns {Message}
   */
  get message() {
    return this._message;
  }

  /**
   *
   * @returns {number}
   */
  get chatId() {
    return this._chatId;
  }

  /**
   *
   * @returns {number}
   */
  get userId() {
    return this._userId;
  }

  /**
   *
   * @returns {boolean}
   */
  get idFromGroupChat() {
    return this._fromGroupChat;
  }

  /**
   *
   * @returns {TelegramApi}
   */
  get api() {
    return this._api;
  }

  /**
   *
   * @returns {files}
   */
  get files() {
    return this._files;
  }

  /**
   * @param {string} key
   * @returns {Promise.<*>}
   */
  getUserSession(key) {
    return this._sessionStorage.getUserSession(this.userId, key);
  }

  /**
   * @param {string} key
   * @param {*} value
   * @returns {Promise}
   */
  setUserSession(key, value) {
    return this._sessionStorage.setUserSession(this.userId, key, value);
  }

  /**
   * @param {string} key
   * @returns {Promise.<*>}
   */
  getChatSession(key) {
    return this._sessionStorage.getChatSession(this.chatId, key);
  }

  /**
   * @param {string} key
   * @param {*} value
   * @returns {Promise}
   */
  setChatSession(key, value) {
    return this._sessionStorage.setChatSession(this.chatId, key, value);
  }

  setCommandParams(params) {
    this._commandParams = params;
  }

  get commandParams() {
    return this._commandParams;
  }

  get commandText() {
    return this.isBotCommand(this.message) ? this.message.text.slice(1) : null;
  }

  /**
   *
   * @returns {BaseLogger}
   */
  get logger() {
    return this._logger;
  }

  /**
   *
   * @returns {boolean}
   */
  get isEditedMessage() {
    return this._isEditedMessage;
  }

  /**
   *
   * @returns {boolean}
   */
  isBotCommand(customMessage) {
    const message = customMessage || this._message;
    return message.entities && message.entities.some(entity => entity.type === 'bot_command');
  }

  /**
   * After calling this the next update
   * from current user will be passed to promise
   *
   * @returns {Promise<Scope>}
   */
  get waitForRequest() {
    return new Promise(resolve => {
      this._waitingRequests[this.chatId] = resolve;
      // this._waitForUpdate(this.chatId)
    });
  }

  /**
   * @callback waitForCallbackQueryCallback
   * @param {CallbackQuery} query
   */

  /**
   * If you send some inline keyboard after that you can call this method,
   * pass to it string callback data or array of string or your InlineKeyboardMarkup
   * and then when user press button CallbackQuery will be passed to callback
   *
   * @param {string|string[]|InlineKeyboardMarkup} data
   * @param {waitForCallbackQueryCallback} callback
   */
  waitForCallbackQuery(data, callback) {
    if (typeof data === 'string') {
      // this._waitForCallback(data)
      this._waitingCallbackQueries[data] = {
        ts: Date.now(),
        cb: callback
      };
    }

    if (Array.isArray(data)) {
      data.forEach(item => {
        // this._waitForCallback(item)
        this._waitingCallbackQueries[item] = {
          ts: Date.now(),
          cb: callback
        };
      });
    }

    if (data instanceof InlineKeyboardMarkup) {
      data.inlineKeyboard.forEach(line => {
        line.forEach(key => {
          // this._waitForCallback(key.callbackData)
          this._waitingCallbackQueries[key.callbackData] = {
            ts: Date.now(),
            cb: callback
          };
        });
      });
    }
  }

  clearCallbackData(callbackData) {
    callbackData.forEach(id => {
      delete this._waitingCallbackQueries[id];
    });
  }

  /**
   *
   * @param {Object} menuData
   * @param {String} [messagePhotoId]
   */
  runMenu(menuData, messagePhotoId) {
    const startMessage = menuData.message;
    const startImage = messagePhotoId || menuData.image;

    const ignoredKeys = [
      'image',
      'message',
      'layout',
      'options',
      'resizeKeyboard',
      'oneTimeKeyboard',
      'matchCommands',
      'anyMatch',
      'static'
    ];

    const keys = Object.keys(menuData);
    let keyboard = [];

    if (menuData.layout) {
      let lineIndex = 0;

      keys.forEach(key => {
        if (ignoredKeys.indexOf(key) === -1) {
          if (!keyboard[lineIndex]) keyboard[lineIndex] = [];

          keyboard[lineIndex].push(new KeyboardButton(key));

          if (typeof menuData.layout === 'number') {
            if (keyboard[lineIndex].length === menuData.layout) {
              lineIndex++;
            }
          } else {
            if (keyboard[lineIndex].length === menuData.layout[lineIndex]) {
              lineIndex++;
            }
          }
        }
      });
    } else {
      keys.forEach(key => {
        if (ignoredKeys.indexOf(key) === -1) {
          keyboard.push([new KeyboardButton(key)]);
        }
      });
    }

    const resizeKeyboard = menuData.resizeKeyboard && menuData.resizeKeyboard === true;
    const oneTimeKeyboard = menuData.oneTimeKeyboard && menuData.oneTimeKeyboard === true;

    const replyMarkup = new ReplyKeyboardMarkup(keyboard, resizeKeyboard, oneTimeKeyboard);

    let options = {
      reply_markup: JSON.stringify(replyMarkup),
      parse_mode: 'html',
      disable_web_page_preview: true
    };

    if (menuData.options) options = Object.assign(options, menuData.options);

    if (!menuData.anyMatch) {
      menuData.anyMatch = $ => $.runMenu(menuData, messagePhotoId);
    }

    this.waitForRequest.then($ => {
      const messageText = $.message.text;
      const matchCommand = menuData.matchCommands && menuData.matchCommands[messageText];

      if (keys.indexOf(messageText) > -1 && ignoredKeys.indexOf(messageText) === -1) {
        if (typeof menuData[messageText] === 'object') {
          $.runMenu(menuData[messageText]);
        } else {
          menuData[messageText]($);
        }
      } else if (matchCommand) {
        matchCommand($);
      } else if (menuData.anyMatch) {
        menuData.anyMatch($);
      } else {
        $.runMenu(menuData);
      }
    });

    if (startImage) {
      return this.sendPhoto(startImage, {
        ...options,
        caption: startMessage
      });
    } else {
      return this.sendMessage(startMessage, options);
    }
  }

  /**
   *
   * @param {Object} formData
   * @param {Function} callback
   */
  runForm(formData, callback) {
    let i = 0;

    const formMessages = [];

    const renderFormKeyboard = formKeyboard => {
      const keyboard = [];

      formKeyboard.forEach(key => {
        keyboard.push([new KeyboardButton(key)]);
      });

      return keyboard;
    };

    const run = errorMessage => {
      const key = keys[i];

      const formMessage = errorMessage || formData[key].q;

      let replyMarkup = '';

      if (formData[key].keyboard) {
        replyMarkup = JSON.stringify({
          one_time_keyboard: false,
          resize_keyboard: formData[key].resize_keyboard || true,
          keyboard: renderFormKeyboard(formData[key].keyboard)
        });
      }

      if (formData[key].removeKeyboard) {
        replyMarkup = JSON.stringify({
          remove_keyboard: true
        });
      }

      this.waitForRequest.then($ => {
        formData[key].validator($.message, (valid, value) => {
          if (valid === true) {
            result[key] = value;
            i++;

            if (i === Object.keys(formData).length) {
              try {
                callback(result);

                if (formData[key].destroyForm) {
                  this.deleteMessages(formMessages);
                }
              } catch (e) {
                this.logger.error({ 'error in user callback:': e });
              }

              return;
            }

            run();
          } else {
            run(formData[key].error);
          }
        });
      });

      this.sendMessage(formMessage, {
        parse_mode: 'html',
        disable_web_page_preview: true,
        reply_markup: replyMarkup
      }).then(message => {
        formMessages.push(message);
      });
    };

    let result = {};
    const keys = Object.keys(formData);

    run();
  }

  /**
   *
   * @param {Object} menuData
   * @param {Object} [prevMessage]
   */
  runInlineMenu(menuData, prevMessage) {
    const { message, method = 'sendMessage', params = [], menu = [], layout = 1, page = 0, limit = 25 } = menuData;

    const menuPages = chunk(menu, limit);
    const menuDefaultItems = menu.filter(item => item.default);

    let keyboard = [];
    let keyboardLayout = layout;
    let callbackData = [];

    const lastPage = menuPages.length - 1;

    const prepareMenuItems = () => {
      const pagination = [];
      const pageItems = menuPages[page] ? menuPages[page].filter(item => !item.default) : menuPages;
      const pageTotalItems = [...pageItems, ...menuDefaultItems];

      if (menu.length > limit) {
        if (page > 0) {
          const prevPage = page - 1;
          const range = `${prevPage * limit + 1}-${page * limit}`;
          pagination.push({
            text: `⬅️ (${range})`,
            callback: query => {
              query.update({ ...menuData, page: prevPage });
            }
          });
        }

        if (page < lastPage) {
          const nextPage = page + 1;
          const rangeStart = nextPage * limit + 1;
          const rangeEnd = (nextPage + 1) * limit;
          const rangeEndFinal = rangeEnd <= menu.length ? rangeEnd : menu.length - 1;
          const range = `${rangeStart}-${rangeEndFinal}`;

          pagination.push({
            text: `➡️ (${range})`,
            callback: query => {
              query.update({ ...menuData, page: nextPage });
            }
          });
        }
      }

      if (Array.isArray(keyboardLayout)) {
        keyboardLayout.push(pagination.length);
      } else {
        keyboardLayout = [...Array(pageTotalItems.length).fill(keyboardLayout), pagination.length];
      }

      return [...pageTotalItems, ...pagination];
    };

    const pageItems = prepareMenuItems();

    if (!keyboardLayout) {
      keyboard = pageItems.map(item => {
        callbackData.push(Math.random().toString(36).substring(7));

        return [new InlineKeyboardButton(item.text, item.url, callbackData[callbackData.length - 1])];
      });
    } else {
      let line = 0;
      pageItems.forEach(item => {
        if (!keyboard[line]) {
          keyboard[line] = [];
        }

        callbackData.push(Math.random().toString(36).substring(7));

        keyboard[line].push(new InlineKeyboardButton(item.text, item.url, callbackData[callbackData.length - 1]));

        let goToNextLine = Array.isArray(keyboardLayout)
          ? keyboard[line].length === keyboardLayout[line]
          : keyboard[line].length === keyboardLayout;

        if (goToNextLine) {
          line++;
        }
      });
    }

    const baseParams = {
      reply_markup: JSON.stringify(new InlineKeyboardMarkup(keyboard)),
      parse_mode: 'html',
      disable_web_page_preview: true
    };

    if (typeof params[params.length - 1] === 'object') {
      params[params.length - 1] = Object.assign(params[params.length - 1], baseParams);
    } else {
      params.push(baseParams);
    }

    const prepareQuery = query => {
      query.answer = text => {
        return text.length > 200 ? this.sendMessage(text) : this.answerCallbackQuery(query.id, text);
      };

      query.update = (menu, message) => {
        if (message) query.answer(message);
        this.runInlineMenu(menu, query.message);
      };

      query.updatePaginated = (menu, message) => {
        if (message) query.answer(message);
        this.runPaginatedMenu(menu, query.message);
      };

      query.prevMenu = message => {
        if (message) query.answer(message);
        this.runInlineMenu(menuData, query.message);
      };

      query.confirm = props => this.runInlineConfirmMenu(props, menuData, query.message);

      query.sendMessage = (text, params) => this.sendMessage(text, params);
      query.runForm = (formData, callback) => this.runForm(formData, callback);

      query.delete = () => this.deleteMessage(query.message);

      query.page = page;

      return query;
    };

    const prepareCallback = response => {
      callbackData.forEach((callbackId, index) => {
        this.waitForCallbackQuery(callbackId, callbackQuery => {
          if (pageItems[index].callback) {
            const query = prepareQuery(callbackQuery);

            pageItems[index].callback(query, response);
          } else {
            this.runInlineMenu(pageItems[index], response);
          }

          this.clearCallbackData(callbackData);
        });
      });
    };

    if (prevMessage) {
      params[0].chat_id = prevMessage.chat.id;
      params[0].message_id = prevMessage.messageId;

      const updateHandlers = {
        sendPhoto: () => this.api.editMessageMedia(params[0]),
        sendMessage: () => this.api.editMessageText(message, params[0])
      };

      const updateHandler = updateHandlers[method]();

      return new Promise(resolve => {
        updateHandler
          .then(response => {
            prepareCallback(response);
            resolve(response);
          })
          .catch(err => console.error(err));
      });
    }

    return new Promise(resolve => {
      this[method].apply(this, [message, ...params]).then(response => {
        prepareCallback(response);
        resolve(response);
      });
    });
  }

  runInlineConfirmMenu(props, prevMenu, prevMessage) {
    const { message, acceptAnswer, acceptDelete, acceptBack, declineDelete, declineAnswer, accept, decline } = props;

    let processing = false;

    const menuData = {
      layout: 2,
      method: 'sendMessage',
      message: message,
      menu: [
        {
          text: '✅',
          callback: query => {
            if (!processing) {
              processing = true;

              if (acceptAnswer) {
                query.answer(acceptAnswer);
              }

              if (acceptDelete) {
                query.delete();
              }

              if (accept) {
                accept(query);
              }

              if (acceptBack) {
                this.runInlineMenu(prevMenu, query.message);
              }
            }
          }
        },
        {
          text: '❌',
          callback: query => {
            if (!processing) {
              processing = true;

              if (declineAnswer) {
                query.answer(declineAnswer);
              }

              if (declineDelete) {
                query.delete();
              }

              if (decline) {
                decline(query);
              }

              this.runInlineMenu(prevMenu, query.message);
            }
          }
        }
      ]
    };

    this.runInlineMenu(menuData, prevMessage);
  }

  /**
   *
   * @param {Object} menuData
   * @param {Object} [prevMenuMessage]
   */
  runPaginatedMenu(menuData, prevMenuMessage) {
    const method = menuData.method || 'sendMessage';
    const page = menuData.page || 0;
    const items = menuData.items || [];
    const isInfinite = menuData.infinite || false;

    let menuPage = page;
    let menuInstance = null;

    const lastPage = items.length - 1;

    const prepareMenu = page => {
      const data = items[page];
      const pagination = [];

      const pageLayout = Array(data.menu.length).fill(1);
      let layout = menuData.layout ? menuData.layout : [...pageLayout, 2];

      if (!data.menu.length) {
        layout = 2;
      }

      if (page > 0 || (isInfinite && items.length > 1)) {
        pagination.push({
          text: '⬅️',
          callback: () => {
            menuPage = isInfinite && page === 0 ? lastPage : menuPage - 1;
            const prevItemMenu = prepareMenu(menuPage);
            this.runInlineMenu(prevItemMenu, menuInstance);
          }
        });
      }

      if (page < lastPage || (isInfinite && items.length > 1)) {
        pagination.push({
          text: '➡️',
          callback: () => {
            menuPage = isInfinite && page === lastPage ? 0 : menuPage + 1;
            const nextItemMenu = prepareMenu(menuPage);
            this.runInlineMenu(nextItemMenu, menuInstance);
          }
        });
      }

      return {
        layout: layout,
        method: method,
        params: data.params,
        message: data.message,
        menu: [...data.menu, ...pagination]
      };
    };

    const itemMenu = prepareMenu(menuPage);

    return new Promise(resolve => {
      this.runInlineMenu(itemMenu, prevMenuMessage).then(response => {
        menuInstance = response;
        resolve(response);
      });
    });
  }

  runPayment(data) {
    const prices = JSON.stringify(data.prices);
    const payload = Math.random().toString(36).substring(7);

    let keyboard = [[]];

    keyboard[0].push(new InlineKeyboardButton(data.button.text, null, null, null, null, null, data.button.pay));

    const options = Object.assign(data.product, {
      prices: prices,
      payload: payload,
      reply_markup: JSON.stringify(new InlineKeyboardMarkup(keyboard))
    });

    const prepareCallback = response => {
      this.waitForCallbackQuery(payload, query => {
        try {
          data.button.callback(query, response);
        } catch (e) {
          this.logger.error({ 'error in user callback:': e });
        }
      });
    };

    this.sendInvoice.call(this, options).then(response => {
      prepareCallback(response);
    });
  }

  //api methods starts here

  /**
   *
   * @param {string} text
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  sendMessage(text, options = {}) {
    return this._api.sendMessage(this.chatId, text, {
      ...options,
      parse_mode: 'html',
      disable_web_page_preview: true
    });
  }

  editMessage(message, text, options = {}) {
    return this._api.editMessageText(text, {
      ...options,
      chat_id: message.chat.id,
      message_id: message.messageId,
      parse_mode: 'html',
      disable_web_page_preview: true
    });
  }

  deleteMessage(message) {
    return this._api.deleteMessage({
      chat_id: message.chat.id,
      message_id: message.messageId
    });
  }

  deleteMessages(messages) {
    messages.forEach(message => this.deleteMessage(message));
  }

  answerCallbackQuery(queryId, text) {
    return this._api.answerCallbackQuery(queryId, {
      show_alert: true,
      text: text
    });
  }

  /**
   *
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  sendInvoice(options) {
    return this._api.sendInvoice(this.chatId, options);
  }

  /**
   *
   * @param {number} fromChatId
   * @param {number} messageId
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  forwardMessage(fromChatId, messageId, options) {
    return this._api.forwardMessage(this.chatId, fromChatId, messageId, options);
  }

  /**
   *
   * @param {InputFile|Object} photo
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  sendPhoto(photo, options) {
    const photoImage = photo || options.image;
    return this._api.sendPhoto(this.chatId, photoImage, {
      ...options,
      parse_mode: 'html',
      disable_web_page_preview: true
    });
  }

  /**
   *
   * @param {InputFile|Object} audio
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  sendAudio(audio, options) {
    return this._api.sendAudio(this.chatId, audio, options);
  }

  /**
   *
   * @param {InputFile|Object} document
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  sendDocument(document, options) {
    return this._api.sendDocument(this.chatId, document, options);
  }

  /**
   *
   * @param {InputFile|Object} sticker
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  sendSticker(sticker, options) {
    return this._api.sendSticker(this.chatId, sticker, options);
  }

  /**
   *
   * @param {InputFile|Object} video
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  sendVideo(video, options) {
    return this._api.sendVideo(this.chatId, video, options);
  }

  /**
   *
   * @param {InputFile|Object} voice
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  sendVoice(voice, options) {
    return this._api.sendVoice(this.chatId, voice, options);
  }

  /**
   *
   * @param {number} latitude
   * @param {number} longitude
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  sendLocation(latitude, longitude, options) {
    return this._api.sendLocation(this.chatId, latitude, longitude, options);
  }

  /**
   *
   * @param {number} latitude
   * @param {number} longitude
   * @param {string} title
   * @param {string}address
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  sendVenue(latitude, longitude, title, address, options) {
    return this._api.sendVenue(this.chatId, latitude, longitude, title, address, options);
  }

  /**
   *
   * @param {string} phoneNumber
   * @param {string} firstName
   * @param {Object} [options]
   * @returns {Promise<Message>}
   */
  sendContact(phoneNumber, firstName, options) {
    return this._api.sendContact(this.chatId, phoneNumber, firstName, options);
  }

  /**
   *
   * @param {string} action
   * @returns {Promise<Object>}
   */
  sendChatAction(action) {
    return this._api.sendChatAction(this.chatId, action);
  }

  /**
   *
   * @param {number} offset
   * @param {number} limit
   * @returns {Promise<UserProfilePhotos>}
   */
  getUserProfilePhotos(offset, limit) {
    return this._api.getUserProfilePhotos(userId, offset, limit);
  }

  /**
   *
   * @param {number} userId
   * @returns {Promise.<boolean>}
   */
  kickChatMember(userId) {
    return this._api.kickChatMember(this.chatId, userId);
  }

  /**
   *
   * @returns {Promise.<boolean>}
   */
  leaveChat() {
    return this._api.leaveChat(this.chatId);
  }

  /**
   *
   * @param {number} userId
   * @returns {Promise.<boolean>}
   */
  unbanChatMember(userId) {
    return this._api.unbanChatMember(this.chatId, userId);
  }

  /**
   *
   * @returns {Promise<Chat>}
   */
  getChat() {
    return this._api.getChat(this.chatId);
  }

  /**
   *
   * @returns {Promise<ChatMember[]>}
   */
  getChatAdministrators() {
    return this._api.getChatAdministrators(this.chatId);
  }

  /**
   *
   * @returns {Promise<number>}
   */
  getChatMembersCount() {
    return this._api.getChatMembersCount(this.chatId);
  }

  /**
   *
   * @param {number} userId
   * @returns {Promise.<ChatMember>}
   */
  getChatMember(userId) {
    return this._api.getChatMember(this.chatId, userId);
  }
}

module.exports = Scope;
