const Telegram = require('bot/lib/core/Telegram');
const agenda = require('services/agenda');
const AbilityModel = require('models/ability');
const CharacterModel = require('models/character');
const InventoryItemModel = require('models/inventory_item');
const LootManager = require('bot/managers/LootManager');
const RegenerationManager = require('bot/managers/RegenerationManager');

const {
  renderCharacterItems,
  renderCharacterArmor,
  renderCharacterDamage,
  renderCharacterSkills,
  renderCharacterPockets
} = require('bot/helpers/character');

const {
  getTotalWeight,
  renderItemTag,
  renderItemDetails,
  renderGiftDetails,
  validateItemRequirements,
  getItemPocketId
} = require('bot/helpers/items');

class InventoryController extends Telegram.TelegramBaseController {
  get routes() {
    return {
      onInventory: 'onInventory',
      onCategory: 'onCategory',
      onPocketUse: 'onPocketUse'
    };
  }

  loadInventory(userId) {
    return CharacterModel.findOne({ userId }).populate({
      path: 'items.weapon items.armor items.helmet items.gloves items.shield items.boots items.belt items.cloak items.amulet items.ring items.bag inventory.items inventory.pockets.p1 inventory.pockets.p2 inventory.pockets.p3',
      populate: { path: 'data' }
    });
  }

  loadPockets(userId) {
    return CharacterModel.findOne({ userId }).populate({
      path: 'inventory.pockets.p1 inventory.pockets.p2 inventory.pockets.p3',
      populate: { path: 'data' }
    });
  }

  loadInventoryItem(userId, itemId) {
    return InventoryItemModel.findOne({ userId, _id: itemId }).populate('data');
  }

  findCharacterByParams(value) {
    return CharacterModel.find({
      $or: [{ customName: value }, { username: value }, { firstName: value }, { userId: value }]
    }).populate('clan');
  }

  async onPocketUse($) {
    const { userId } = $;
    const character = await this.loadPockets(userId);

    const tx = character.getPhrases();
    const item = character.inventory.pockets.p1;
    const itemTitle = item.renderTag(tx.lang);

    if (!item || !item.data) {
      return $.sendMessage(tx.pocketIsEmpty);
    }

    if (item.used) {
      const message = character.t('itemUsedBefore', { itemTitle });
      return $.sendMessage(message);
    }

    const isPotion = item.data.type === 'potion';

    if (isPotion) {
      return this.onPotionUse(character, item)
        .then(({ message }) => $.sendMessage(message))
        .catch(message => $.sendMessage(message));
    }

    return false;
  }

  async onInventory($) {
    const { userId } = $;
    const character = await this.loadInventory(userId);
    const inventoryMenu = this.renderInventory(character);

    $.runInlineMenu(inventoryMenu);
  }

  async onCategory($) {
    const { userId, commandText } = $;
    const character = await this.loadInventory(userId);
    const categoryMenu = this.renderCategory(character, {
      category: commandText
    });

    $.runInlineMenu(categoryMenu);
  }

  onPotionUse(character, item) {
    const { userId } = character;
    const tx = character.getPhrases();

    return new Promise(async (resolve, reject) => {
      const { id, value } = item.data.effects[0];

      if (id === 'health') {
        const regenerationState = RegenerationManager.getState(userId);

        if (!regenerationState) {
          return reject(tx.itemRegenerationUseless);
        }

        const restoredHealth = RegenerationManager.regenerate(userId, value);

        item.depreciation += 1;
        item.used = item.maxDepreciation === item.depreciation;

        await item.save();
        const message = character.t('itemRegenerated', { restoredHealth });

        return resolve({ item, character, message });
      }

      if (id === 'randomAbility') {
        const randomAbility = await AbilityModel.getRandom(character.abilities);

        if (!randomAbility) {
          return reject(tx.randomAbilityError);
        }

        const job = await agenda.schedule(`6 hours later`, 'cancel_ability', {
          userId,
          abilityId: randomAbility.id
        });

        item.depreciation += 1;
        item.used = item.maxDepreciation === item.depreciation;
        character.abilities.push(randomAbility.id);

        await job.save();
        await character.save();
        await item.save();

        const title = randomAbility.title[tx.lang];
        const message = character.t('randomAbilityActivated', { title });

        return resolve({ item: null, character, message });
      }

      return reject(tx.potionUseError);
    });
  }

  getInventoryMessage(character) {
    const tx = character.getPhrases();
    const {
      inventory: { gold, credits, items, capacity, pockets },
      modificators
    } = character;

    const weight = getTotalWeight(items);
    const totalCapacity = modificators.capacity > 0 ? `${capacity} (+${modificators.capacity})` : capacity;

    const characterTag = character.renderTag({ showHealth: true });
    const characterArmor = renderCharacterArmor(tx, character);
    const characterDamage = renderCharacterDamage(tx, character);
    const characterSkills = renderCharacterSkills(tx, character);
    const characterItems = renderCharacterItems(tx, character.items);
    const characterPockets = renderCharacterPockets(tx, pockets);

    const _gold = `<b>💰 ${tx.labelGold}:</b> ${gold}`;
    const _credits = `<b>💎 ${tx.labelCredits}:</b> ${credits}`;
    const _capacity = `<b>${tx.labelCapacity}:</b> ${weight}/${totalCapacity}`;

    return `${characterTag}\n\n${_gold}\n${_credits}\n${_capacity}\n\n${characterSkills}\n\n${characterDamage}\n${characterArmor}\n\n${characterItems}\n${characterPockets}`;
  }

  getSortedItems(character) {
    const { items } = character.inventory;

    return items.reduce(
      (data, item) => {
        if (item.isGift) return { ...data, gifts: [...data.gifts, item] };
        if (item.isPotion) return { ...data, potions: [...data.potions, item] };

        return { ...data, ammunition: [...data.ammunition, item] };
      },
      {
        ammunition: [],
        potions: [],
        gifts: []
      }
    );
  }

  getActiveItems(character) {
    const itemsObject = character.items.toObject();
    return Object.keys(itemsObject).filter(area => character.items[area] && character.items[area].data);
  }

  renderInventory(character) {
    const tx = character.getPhrases();
    const activeItems = this.getActiveItems(character);
    const sortedItems = this.getSortedItems(character);
    const inventoryMessage = this.getInventoryMessage(character);

    const categoriesMenu = Object.keys(sortedItems).map(category => {
      const items = sortedItems[category];
      const tag = character.t(`button.${category}`, { count: items.length });
      return {
        default: true,
        text: tag,
        callback: query => {
          const categoryMenu = this.renderCategory(character, { category });
          query.update(categoryMenu);
        }
      };
    });

    const inventoryMenu = {
      layout: 1,
      method: 'sendMessage',
      message: inventoryMessage,
      menu: categoriesMenu
    };

    if (activeItems.length > 0) {
      const deactivateAllButton = {
        default: true,
        text: tx.labelDeactivateAll,
        callback: query => {
          query.confirm({
            message: tx.labelDeactivateAllQuestion,
            accept: async _query => {
              activeItems.forEach(area => {
                character.items[area] = null;
              });

              await character.save();

              const successMessage = character.t('itemsDeactivated');
              const inventoryMenu = this.renderInventory(character);

              _query.update(inventoryMenu, successMessage);
            }
          });
        }
      };

      inventoryMenu.menu.push(deactivateAllButton);
    }

    if (!character.inventory.items.length) {
      inventoryMenu.message += tx.inventoryNoItemsMessage;
    }

    return inventoryMenu;
  }

  renderCategory(character, params = {}) {
    const { page = 0, category } = params;

    const tx = character.getPhrases();
    const sortedItems = this.getSortedItems(character);
    const menuMessage = this.getInventoryMessage(character);
    const categoryItems = sortedItems[category];

    const categoryMenu = {
      layout: 1,
      method: 'sendMessage',
      message: menuMessage,
      menu: [],
      page
    };

    const menuBack = {
      default: true,
      text: tx.labelBack,
      callback: query => {
        const prevMenu = this.renderInventory(character);
        query.update(prevMenu);
      }
    };

    if (categoryItems.length > 0) {
      const itemsMenu = categoryItems.reduce((menu, item, index) => {
        const itemNumber = index + 1;
        const itemObject = item.toObject();
        const itemTag = renderItemTag(tx, character, itemObject);
        return [
          ...menu,
          {
            text: `[${itemNumber}] ${itemTag}`,
            callback: query => this.sendItem(query, character, item, params)
          }
        ];
      }, []);

      return { ...categoryMenu, menu: [...itemsMenu, menuBack] };
    }

    return { ...categoryMenu, menu: [menuBack] };
  }

  sendGiftForm(query, tx, item, character) {
    const { userId } = character;
    const title = item.renderTag(tx.lang);

    const giftForm = {
      name: {
        q: character.t('giftSendFormName', { title }),
        error: tx.giftSendFormError,
        validator: ({ text }, callback) => (text ? callback(true, text) : callback(false))
      },
      notice: {
        destroyForm: true,
        q: tx.giftSendFormNotice,
        error: tx.giftSendFormError,
        validator: ({ text }, callback) => (text ? callback(true, text) : callback(false))
      }
    };

    const handleSend = (recipient, notice) => {
      const senderTag = character.renderTag();
      const recipientTag = recipient.renderTag();

      if (recipient._id.equals(character.id)) {
        return query.prevMenu(tx.giftSendSameHero);
      }

      return query.confirm({
        message: character.t('giftSendQuestion', { title, recipientTag }),
        accept: async _query => {
          const _item = await this.loadInventoryItem(userId, item.id);

          if (_item) {
            character.inventory.items.pull(_item.id);
            recipient.inventory.items.push(_item.id);

            _item.set('userId', recipient.userId);

            await recipient.save();
            await character.save();
            await _item.save();

            recipient.notify('giftReceivedMessage', {
              title,
              senderTag,
              notice
            });
          }

          const categoryMenu = this.renderCategory(character, {
            category: 'gifts'
          });
          const messageParams = { title, recipientTag };
          const message = _item ? character.t('giftSendSuccess', messageParams) : character.t('giftUseError');

          return _query.update(categoryMenu, message);
        }
      });
    };

    query.runForm(giftForm, async ({ name, notice }) => {
      const recipients = await this.findCharacterByParams(name);

      if (recipients.length <= 0) {
        return query.prevMenu(tx.giftSendNotFound);
      }

      if (recipients.length > 1) {
        const menuButtons = recipients.map((recipient, index) => ({
          text: `${index + 1}. ${recipient.renderTag()}`,
          callback: () => handleSend(recipient, notice)
        }));

        return query.update({
          layout: 1,
          method: 'sendMessage',
          message: tx.giftSendSelect,
          menu: [
            ...menuButtons,
            {
              text: tx.labelCancel,
              callback: () => query.prevMenu()
            }
          ]
        });
      }

      return handleSend(recipients[0], notice);
    });
  }

  getGiftMenu(query, item, character) {
    const { userId } = character;
    const { rarity, giftEvent, giftSize } = item.data;

    const tx = character.getPhrases();
    const itemTitle = item.renderTag(tx.lang);
    const menu = [];

    menu.push({
      text: tx.labelItemOpen,
      callback: query => {
        query.confirm({
          message: character.t('itemOpenQuestion', { itemTitle }),
          accept: async _query => {
            const _item = await this.loadInventoryItem(userId, item.id);

            let message = tx.giftUseError;

            if (_item) {
              await item.remove();
              const lootItems = LootManager.getLootFromGift(rarity, giftEvent, giftSize);
              const lootItemTags = await character.saveLoot(lootItems, {
                giftId: item.id,
                isFormatted: false
              });

              message = character.t('lootMessage.giftOpen', {
                itemTags: lootItemTags.join('\n')
              });

              _query.sendMessage(message);
            }

            const categoryMenu = this.renderCategory(character, {
              category: 'gifts'
            });

            _query.update(categoryMenu, message);
          }
        });
      }
    });

    menu.push({
      text: tx.labelItemPresent,
      callback: query => {
        query.prevMenu();
        this.sendGiftForm(query, tx, item, character);
      }
    });

    return menu;
  }

  getPotionMenu(query, item, character, onUpdate) {
    const { isBroken } = item;
    const { items, pockets } = character.inventory;

    const tx = character.getPhrases();
    const itemTitle = item.getTitle(tx.lang);
    const itemValidation = validateItemRequirements(tx, character, item.data);
    const inPocketId = getItemPocketId(pockets, item.id);
    const menu = [];

    if (!isBroken && itemValidation.valid) {
      menu.push({
        text: tx.labelActivate,
        callback: _query => {
          this.onPotionUse(character, item)
            .then(({ message, character, item }) => {
              _query.answer(message);

              if (item) {
                onUpdate(character, item);
              } else {
                _query.delete();
              }
            })
            .catch(message => {
              _query.answer(message);
              _query.prevMenu();
            });
        }
      });
    }

    if (inPocketId) {
      menu.push({
        text: tx.labelPocketRemove,
        callback: async query => {
          character.inventory.pockets[inPocketId] = null;

          await character.save();
          await query.answer(
            character.t('itemPocketRemoveSuccess', {
              itemTitle
            })
          );

          onUpdate(character);
        }
      });
    } else {
      menu.push({
        text: tx.labelPocketAdd,
        callback: async query => {
          character.inventory.pockets.p1 = item.id;

          await character.save();
          await query.answer(character.t('itemPocketAddSuccess', { itemTitle }));

          onUpdate(character);
        }
      });
    }

    menu.push({
      text: tx.labelUnitePotions,
      callback: query => {
        const samePotions = items.filter(_item => _item.isSameItem(item));
        const { minPortions, maxPortions } = samePotions.reduce(
          (total, potion) => {
            total.minPortions += !potion.used ? potion.depreciation : 0;
            total.maxPortions += !potion.used ? potion.maxDepreciation : 0;
            return total;
          },
          {
            minPortions: item.depreciation,
            maxPortions: item.maxDepreciation
          }
        );

        if (maxPortions <= item.maxDepreciation) {
          return query.prevMenu(character.t('potionsUniteUseless', { itemTitle }));
        }

        return query.confirm({
          message: character.t('potionsUniteQuestion', {
            itemTitle,
            minPortions,
            maxPortions
          }),
          accept: async query => {
            item.depreciation = minPortions;
            item.maxDepreciation = maxPortions;
            item.used = item.depreciation === item.maxDepreciation;

            const _item = await item.save();
            const _character = await character.removeItems(samePotions);
            await query.answer(
              character.t('potionsUniteSuccess', {
                itemTitle,
                minPortions,
                maxPortions
              })
            );

            onUpdate(_character, _item);
          }
        });
      }
    });

    return menu;
  }

  getAmmunitionMenu(query, item, character, onUpdate) {
    const { isBroken } = item;
    const { items } = character;

    const tx = character.getPhrases();
    const isActive = item.isActive(items);
    const itemValidation = validateItemRequirements(tx, character, item.data);
    const itemTitle = item.getTitle(tx.lang);
    const menu = [];

    if (!isActive && !isBroken && itemValidation.valid) {
      menu.push({
        text: tx.labelActivate,
        callback: async query => {
          character.items[item.data.area] = item._id;

          await character.save();
          await query.answer(character.t('itemActivated', { itemTitle }));

          onUpdate(character);
        }
      });
    }

    if (isActive) {
      menu.push({
        text: tx.labelDeactivate,
        callback: async query => {
          character.items[item.data.area] = null;

          await character.save();
          await query.answer(character.t('itemDeactivated', { itemTitle }));

          onUpdate(character);
        }
      });
    }

    return menu;
  }

  sendItem(query, character, item, params) {
    const tx = character.getPhrases();
    const itemObject = item.toObject();
    const { category } = params;
    const {
      userId,
      items,
      inventory: { pockets }
    } = character;

    const isActive = item.isActive(items);
    const inPocketId = getItemPocketId(pockets, item.id);

    const isInUse = isActive || inPocketId;
    const itemValidation = validateItemRequirements(tx, character, item.data);
    const itemDetails = item.isGift
      ? renderGiftDetails(tx, item)
      : renderItemDetails(tx, character, itemObject, itemValidation, isInUse);

    const itemInfo = itemValidation.messages.join('❗\n');
    const itemMessage = itemDetails + itemInfo;
    const itemTitle = item.getTitle(tx.lang);

    const onItemUpdate = (_character = character, _item = item) => this.sendItem(query, _character, _item, params);

    const menuHandlers = {
      ammunition: this.getAmmunitionMenu,
      potions: this.getPotionMenu,
      gifts: this.getGiftMenu
    };

    const getItemMenu = menuHandlers[category].bind(this);
    const itemTypeMenu = getItemMenu(query, item, character, onItemUpdate);

    const itemMenu = {
      layout: 1,
      method: 'sendMessage',
      message: itemMessage,
      menu: itemTypeMenu
    };

    itemMenu.menu.push({
      text: tx.labelThrowOut,
      callback: query => {
        query.confirm({
          message: character.t('inventoryItemRemoveQuestion', { itemTitle }),
          accept: async query => {
            const _character = await character.removeItems([item]);
            const categoryMenu = this.renderCategory(_character, { category });
            const message = character.t('inventoryItemRemoved', { itemTitle });

            query.update(categoryMenu, message);
          }
        });
      }
    });

    itemMenu.menu.push({
      text: tx.labelBack,
      callback: async () => {
        const character = await this.loadInventory(userId);
        const menu = this.renderCategory(character, params);
        query.update(menu);
      }
    });

    query.update(itemMenu);
  }
}

module.exports = InventoryController;
