const { TelegramBaseController } = require('bot/lib/core/Telegram');
const MenuHelper = require('bot/helpers/menu');
const ItemModel = require('models/item');
const LeagueModel = require('models/league');
const CharacterModel = require('models/character');
const InventoryItemModel = require('models/inventory_item');
const {
  getTotalWeight,
  getSellingPrice,
  getRepairPrice,
  renderItemTag,
  renderItemDetails,
  renderGiftDetails,
  validateItemRequirements
} = require('bot/helpers/items');

class ShopController extends TelegramBaseController {
  get routes() {
    return {
      onShop: 'sendShopMenu',
      onSell: 'sendSellMenu',
      onRepair: 'sendRepairMenu',
      onWeapons: 'onWeapons',
      onArmors: 'onArmors',
      onJewelry: 'onJewelry',
      onPotions: 'onPotions',
      onGifts: 'onGifts',
      onOther: 'onOther'
    };
  }

  loadCharacter(userId) {
    return CharacterModel.findOne({ userId }).populate([
      { path: 'inventory.items', populate: { path: 'data' } },
      { path: 'items.weapon' },
      { path: 'items.armor' },
      { path: 'items.helmet' },
      { path: 'items.gloves' },
      { path: 'items.shield' },
      { path: 'items.boots' },
      { path: 'items.belt' },
      { path: 'items.cloak' },
      { path: 'items.amulet' },
      { path: 'items.ring' },
      { path: 'items.bag' }
    ]);
  }

  loadProducts(params) {
    const searchQuery = {
      display: true,
      $or: [{ requirements: { $elemMatch: { id: 'level', value: params.level } } }, { level: params.level }]
    };

    if (params.proximo) {
      searchQuery.features = { $elemMatch: { id: 'proximoWeapon' } };
    }

    if (params.category) {
      searchQuery.category = params.category;
    }

    if (params.type) {
      searchQuery.type = params.type;
    }

    return ItemModel.find(searchQuery).sort({ price: 1 });
  }

  async sendShopMenu($, customMessage) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);

    const tx = character.getPhrases();
    const activeJob = character.getActiveJob(tx);

    if (activeJob) {
      return MenuHelper.sendMainMenu($, tx, {
        message: character.t('characterBusyMessage', {
          busyLabel: activeJob.label
        })
      });
    }

    const shopMenu = this.renderShopMenu($, tx, character, customMessage);

    return customMessage ? $.runMenu(shopMenu) : $.runMenu(shopMenu, $.files.shop);
  }

  renderShopMenu($, tx, character, customMessage) {
    const { inventory } = character;
    const mainMenuMessage = `${tx.shopMenuGoldMessage}: 💰${tx.labelGold} ‒ ${inventory.gold}, 💎${tx.labelCredits} ‒ ${inventory.credits}\n\n${tx.shopMenuMessage}`;

    return {
      layout: 2,
      resizeKeyboard: true,
      message: customMessage || mainMenuMessage,
      [tx.labelWeapons]: $ => {
        $.emulateUpdate();
      },
      [tx.labelArmors]: $ => {
        $.emulateUpdate();
      },
      [tx.labelJewelry]: $ => {
        $.emulateUpdate();
      },
      [tx.labelPotions]: $ => {
        $.emulateUpdate();
      },
      [tx.labelOthers]: $ => {
        $.emulateUpdate();
      },
      [tx.labelGifts]: $ => {
        $.emulateUpdate();
      },
      [tx.labelSellItems]: $ => {
        $.emulateUpdate();
      },
      [tx.labelRepairItems]: $ => {
        $.emulateUpdate();
      },
      [tx.labelBack]: $ => {
        MenuHelper.sendTownMenu($, tx, {
          message: tx.shopMenuMessageBack
        });
      }
    };
  }

  async onGifts($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const shopMenu = this.renderShopMenu($, tx, character);

    return this.sendProductsMenu($, tx, shopMenu, character, {
      level: 1,
      category: 'gifts'
    });
  }

  async onOther($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const othersMenu = {
      layout: 1,
      resizeKeyboard: true,
      message: tx.shopOthersMessage,
      [tx.labelBags]: $ => {
        this.sendProductsMenu($, tx, othersMenu, character, {
          level: 1,
          category: 'bags'
        });
      },
      [tx.labelEquipment]: $ => {
        this.sendProductsMenu($, tx, othersMenu, character, {
          level: 1,
          type: 'equipment'
        });
      },
      [tx.labelBack]: $ => this.sendShopMenu($)
    };

    $.runMenu(othersMenu);
  }

  async onPotions($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const shopMenu = this.renderShopMenu($, tx, character);

    return this.sendProductsMenu($, tx, shopMenu, character, {
      level: 1,
      category: 'potions'
    });
  }

  async onJewelry($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const armorsMenu = {
      layout: 2,
      resizeKeyboard: true,
      message: tx.shopJewelryMessage,
      [tx.labelRings]: $ => this.sendLevelsMenu($, tx, armorsMenu, 'rings', character),
      [tx.labelAmulets]: $ => this.sendLevelsMenu($, tx, armorsMenu, 'amulets', character),
      [tx.labelBack]: $ => this.sendShopMenu($)
    };

    $.runMenu(armorsMenu);
  }

  async onArmors($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const armorsMenu = {
      layout: 2,
      resizeKeyboard: true,
      message: tx.shopArmorsMessage,
      [tx.labelHelmets]: $ => this.sendLevelsMenu($, tx, armorsMenu, 'helmets', character),
      [tx.labelGloves]: $ => this.sendLevelsMenu($, tx, armorsMenu, 'gloves', character),
      [tx.labelArmors2]: $ => this.sendLevelsMenu($, tx, armorsMenu, 'armors', character),
      [tx.labelShields]: $ => this.sendLevelsMenu($, tx, armorsMenu, 'shields', character),
      [tx.labelBoots]: $ => this.sendLevelsMenu($, tx, armorsMenu, 'boots', character),
      [tx.labelBelts]: $ => this.sendLevelsMenu($, tx, armorsMenu, 'belts', character),
      [tx.labelCloaks]: $ => this.sendLevelsMenu($, tx, armorsMenu, 'cloaks', character),
      [tx.labelBack]: $ => this.sendShopMenu($)
    };

    $.runMenu(armorsMenu);
  }

  async onWeapons($) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const weaponsMenu = {
      layout: 2,
      resizeKeyboard: true,
      message: tx.shopWeaponsMessage,
      [tx.labelSwords]: $ => this.sendLevelsMenu($, tx, weaponsMenu, 'swords', character),
      [tx.labelAxes]: $ => this.sendLevelsMenu($, tx, weaponsMenu, 'axes', character),
      [tx.labelHammers]: $ => this.sendLevelsMenu($, tx, weaponsMenu, 'hammers', character),
      [tx.labelSpears]: $ => this.sendLevelsMenu($, tx, weaponsMenu, 'spears', character),
      [tx.labelDaggers]: $ => this.sendLevelsMenu($, tx, weaponsMenu, 'daggers', character),
      [tx.labelProximoFights]: $ => {
        this.sendProductsMenu($, tx, weaponsMenu, character, {
          level: 2,
          proximo: true
        });
      },
      [tx.labelBack]: $ => this.sendShopMenu($)
    };

    $.runMenu(weaponsMenu);
  }

  async sendSellMenu($, prevMessage) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const items = character.inventory.items.filter(
      item => item.depreciation !== item.maxDepreciation || item.maxDepreciation === 1
    );

    const sellMenu = {
      layout: 1,
      method: 'sendMessage',
      message: tx.shopSellMenuMessage,
      menu: []
    };

    if (items.length > 0) {
      sellMenu.menu = items.reduce((menu, item) => {
        const { area } = item.data;
        const isActive = character.items[area] && character.items[area]._id.equals(item._id);
        const itemSellCost = getSellingPrice([item]);
        const itemObject = item.toObject();
        const itemTag = renderItemTag(tx, character, itemObject);

        return [
          ...menu,
          {
            text: `💰${itemSellCost} ${itemTag}`,
            callback: query => {
              query.confirm({
                message: character.t('shopSellItemMessage', {
                  price: itemSellCost,
                  title: itemTag
                }),
                accept: async _query => {
                  if (isActive) {
                    character.items[area] = null;
                  }

                  character.inventory.gold += itemSellCost;
                  character.inventory.items.pull(item._id);

                  await item.remove();
                  await character.save();

                  _query.answer(
                    character.t('shopSellItemSuccess', {
                      price: itemSellCost
                    })
                  );

                  return this.sendSellMenu($, _query.message);
                }
              });
            }
          }
        ];
      }, []);
    } else {
      sellMenu.message = tx.shopSellEmptyMessage;
    }

    $.runInlineMenu(sellMenu, prevMessage);
  }

  async sendRepairMenu($, prevMessage) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const tx = character.getPhrases();
    const items = character.inventory.items.filter(
      item =>
        !item.used &&
        item.depreciation > 0 &&
        item.maxDepreciation > 1 &&
        item.data.type !== 'potion' &&
        getRepairPrice([item]) > 0
    );

    const repairMenu = {
      layout: 1,
      method: 'sendMessage',
      message: tx.shopRepairMenuMessage,
      menu: []
    };

    if (items.length > 0) {
      const repairItemsMenu = items.reduce((menu, item) => {
        const repairCost = getRepairPrice([item]);
        const itemObject = item.toObject();
        const itemTag = renderItemTag(tx, character, itemObject, {
          hideUseIcon: true
        });

        return [
          ...menu,
          {
            text: `💰${repairCost} ${itemTag}`,
            callback: async query => {
              const [isEnoughGold, gold] = await character.isEnoughGold(repairCost);

              if (!isEnoughGold) {
                return query.answer(character.t('messageNoGold', { gold }));
              }

              return query.confirm({
                message: character.t('shopRepairItemMessage', {
                  title: itemTag,
                  price: repairCost
                }),
                accept: async _query => {
                  await item.repair();
                  await character.pay({ gold: repairCost });

                  _query.answer(
                    character.t('shopRepairItemSuccess', {
                      title: renderItemTag(tx, character, itemObject, {
                        hideUseIcon: true,
                        hideUsage: true
                      })
                    })
                  );

                  return this.sendRepairMenu($, _query.message);
                }
              });
            }
          }
        ];
      }, []);

      const repairAllMenu = {
        default: true,
        text: tx.labelRepairAll,
        callback: async query => {
          const repairCost = getRepairPrice(items);
          const [isEnoughGold, gold] = await character.isEnoughGold(repairCost);

          if (!isEnoughGold) {
            return query.answer(character.t('messageNoGold', { gold }));
          }

          return query.confirm({
            message: character.t('shopRepairItemsAllMessage', {
              price: repairCost
            }),
            accept: async _query => {
              const repairItemIds = items.reduce((ids, item) => [...ids, item._id], []);

              await character.pay({ gold: repairCost });
              await InventoryItemModel.updateMany(
                { _id: { $in: repairItemIds } },
                { depreciation: 0, $inc: { maxDepreciation: -1 } }
              );

              _query.answer(tx.shopRepairItemsAllSuccess);

              return this.sendRepairMenu($, query.message);
            }
          });
        }
      };

      repairMenu.menu = [repairAllMenu, ...repairItemsMenu];
    } else {
      repairMenu.message = tx.shopRepairEmptyMessage;
    }

    $.runInlineMenu(repairMenu, prevMessage);
  }

  getProductsMenu($, tx, products, character, page = 0) {
    const menuItems = products.map((product, index) => {
      const { price, priceCreditsCalculated, onlyCredits, isGift } = product;
      const number = character.t('labelCountOf', {
        count: index + 1,
        total: products.length
      });

      const itemData = { data: product, number };
      const validation = validateItemRequirements(tx, character, product);
      const details = isGift ? renderGiftDetails(tx, itemData) : renderItemDetails(tx, character, itemData, validation);

      const productMenuItem = {
        message: `${details}`,
        menu: [
          {
            text: `💰 ${price}`,
            callback: query => {
              return this.buyProduct($, tx, query, products, product, {
                index,
                quantity: 1,
                priceGold: price
              });
            }
          }
        ]
      };

      const buyForCreditsOption = {
        text: `💎 ${priceCreditsCalculated}`,
        callback: query => {
          return this.buyProduct($, tx, query, products, product, {
            index,
            quantity: 1,
            priceCredits: priceCreditsCalculated
          });
        }
      };

      if (onlyCredits) {
        productMenuItem.menu = [buyForCreditsOption];
      } else {
        productMenuItem.menu.push(buyForCreditsOption);
      }

      if (product.isPotion) {
        const packs = [{ quantity: 1 }, { quantity: 5 }, { quantity: 10 }, { quantity: 20 }];

        productMenuItem.menu = packs.map(({ quantity }) => {
          const buttonText = `💰${price * quantity} (x${quantity})`;
          return {
            text: buttonText,
            callback: query => {
              return this.buyProduct($, tx, query, products, product, {
                index,
                quantity: quantity,
                priceGold: price,
                priceCredits: null
              });
            }
          };
        });
      }

      return productMenuItem;
    });

    return {
      page,
      layout: [2, 2],
      infinite: true,
      items: menuItems
    };
  }

  async buyProduct($, tx, query, products, product, params = {}) {
    const { userId } = $;
    const character = await this.loadCharacter(userId);
    const { quantity, priceGold, priceCredits, index } = params;
    const { gold, credits, capacity, items } = character.inventory;

    const prevMenu = this.getProductsMenu($, tx, products, character, index);

    const totalPrice = priceGold ? product.price * quantity : product.priceCreditsCalculated * quantity;

    const totalWeight = getTotalWeight(items);
    const isEnoughSpace = totalWeight + product.weight <= capacity;

    const errors = [];

    if (product.weight > 0 && !isEnoughSpace) {
      errors.push(tx.shopMessageNoSpace);
    }

    if (priceGold && gold < totalPrice) {
      errors.push(character.t('messageNoGold', { gold }));
    }

    if (priceCredits && credits < totalPrice) {
      errors.push(character.t('messageNoCredits', { credits }));
    }

    if (errors.length > 0) {
      return query.updatePaginated(prevMenu, errors.join('\n\n'));
    }

    const title = `${product._title[tx.lang]} (${quantity})`;
    const price = priceGold ? `💰 ${totalPrice} ${tx.labelOfGold}` : `💎 ${totalPrice}`;

    const durability = product.isPotion ? quantity : product.maxDurability;

    return query.confirm({
      message: character.t('shopBuyItemMessage', { title, price }),
      accept: async _query => {
        const item = await InventoryItemModel.create({
          userId: character.userId,
          data: product._id,
          maxDepreciation: durability
        });

        if (item) {
          character.inventory.items.push(item._id);

          if (priceGold) {
            character.inventory.gold -= totalPrice;
          }

          if (priceCredits) {
            character.inventory.credits -= totalPrice;
          }

          await character.save();

          const msgKey = product.isAbilityPotion ? 'shopBuyAbilityPotionSuccess' : 'shopBuyItemSuccess';

          _query.updatePaginated(prevMenu, character.t(msgKey, { title }));
        }
      }
    });
  }

  async sendProductsMenu($, tx, prevMenu, character, params) {
    const products = await this.loadProducts(params);

    if (products.length > 0) {
      const message = character.t('shopProductsCategoryMessage', {
        count: products.length
      });

      await $.runMenu({ ...prevMenu, message });
      const productsMenu = this.getProductsMenu($, tx, products, character);

      return $.runPaginatedMenu(productsMenu);
    }

    return $.runMenu({ ...prevMenu, message: tx.shopEmptyCategoryMessage });
  }

  sendLevelsMenu($, tx, prevMenu, category, character) {
    const categoryLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

    let categoryMenu = {
      layout: [4, 4, 4, 3, 2],
      resizeKeyboard: true,
      message: tx.shopCategoryMessage
    };

    const backMenu = {
      [tx.labelBack]: $ => $.runMenu(prevMenu),
      [tx.labelTown]: $ => {
        MenuHelper.sendTownMenu($, tx, {
          message: tx.shopMenuMessageBack
        });
      }
    };

    const levelsMenu = categoryLevels.reduce((menu, level) => {
      const buttonTag = `${level} ${tx.labelLevelText}`;
      return {
        ...menu,
        [buttonTag]: $ =>
          this.sendProductsMenu($, tx, categoryMenu, character, {
            category,
            level
          })
      };
    }, {});

    categoryMenu = { ...categoryMenu, ...levelsMenu, ...backMenu };

    $.runMenu(categoryMenu);
  }
}

module.exports = ShopController;
