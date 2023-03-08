const CharacterModel = require('models/character');
const { sendMessage, sendAdminsReport } = require('bot/helpers/reports');
const { roundBy } = require('utils');

class NewsletterQueue {
  constructor(messages, image, button) {
    this.messages = messages;
    this.image = image;
    this.button = button;
    this.limit = 50;
    this.skip = 0;
    this.blockedUserIds = [];
    this.activeUserIds = [];

    this.startTime = this.getCurrentTime();
  }

  getButtonParams() {
    if (!this.button) {
      return {};
    }

    const replyMarkup = {
      inline_keyboard: [[{ text: this.button.text, url: this.button.url }]]
    };

    return {
      reply_markup: JSON.stringify(replyMarkup)
    };
  }

  loadDocs(skip) {
    return CharacterModel.find({
      deleted: false,
      blocked: { $ne: [false, null] }
    })
      .select({ userId: 1, userLang: 1 })
      .skip(skip)
      .limit(this.limit)
      .lean();
  }

  countDocs() {
    return CharacterModel.countDocuments({
      deleted: false,
      blocked: { $ne: [false, null] }
    });
  }

  getCurrentTime() {
    return new Date().getTime();
  }

  getDuration() {
    const endTime = this.getCurrentTime();
    const diff = endTime - this.startTime;
    const minutes = diff / (1000 * 60);

    return roundBy(minutes, 2);
  }

  async updateUsers() {
    await CharacterModel.updateMany({ userId: { $in: this.blockedUserIds } }, { blocked: true }).exec();
    await CharacterModel.updateMany({ userId: { $in: this.activeUserIds } }, { blocked: false }).exec();
  }

  sendReports() {
    const time = this.getDuration();
    const activeCount = this.activeUserIds.length;
    const blockedCount = this.blockedUserIds.length;

    const message = `Newsletter done in ${time} minutes.\n\nReceived - ${activeCount}\nBlocked - ${blockedCount}`;

    sendAdminsReport(message);
  }

  async run() {
    this.count = await this.countDocs();
    const docs = await this.loadDocs(this.skip);

    const sendMessages = async () => {
      await Promise.all(
        docs.map(async data => {
          const { userId, userLang } = data;
          const message = this.messages[userLang];

          try {
            const buttonParams = this.getButtonParams();
            await sendMessage(userId, message, this.image, {
              ...buttonParams,
              parse_mode: 'html'
            });

            this.activeUserIds.push(userId);
          } catch (err) {
            const isBlocked = err.code === 403;

            if (isBlocked) {
              this.blockedUserIds.push(userId);
            }
          }
        })
      );
    };

    await sendMessages();

    const isDone = this.count <= this.skip + this.limit;

    if (!isDone) {
      this.skip += this.limit;

      return this.run();
    }

    this.updateUsers();
    this.sendReports();

    return true;
  }
}

module.exports = NewsletterQueue;
