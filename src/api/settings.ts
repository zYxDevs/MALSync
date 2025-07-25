import { reactive, ref } from 'vue';
import { ChibiListRepository } from '../pages-chibi/loader/ChibiListRepository';
import type { PageListJsonInterface } from '../pages-chibi/pageInterface';

export const settingsObj = {
  options: reactive({
    autoTrackingModeanime: 'video',
    readerTracking: true,
    askBefore: true,
    autoTrackingModemanga: 'instant',
    enablePages: {},
    forceEn: false,
    forceEnglishTitles: false,
    rpc: true,
    presenceLargeImage: 'cover',
    presenceShowButtons: true,
    presenceShowMalsync: false,
    userscriptModeButton: false,
    syncMode: 'MAL',
    syncModeSimkl: 'MAL',
    localSync: true,
    delay: 0,
    videoDuration: 85,
    malTags: false,
    malContinue: true,
    malResume: true,
    usedPage: true,
    epPredictions: true,
    mangaCompletionPercentage: 90,

    theme: 'auto',
    themeSidebars: true,
    themeColor: '#000000',
    themeOpacity: 100,
    themeImage: '',

    minimalWindow: false,
    posLeft: 'left',
    miniMALonMal: false,
    floatButtonStealth: false,
    minimizeBigPopup: false,
    floatButtonCorrection: true,
    floatButtonHide: false,
    autoCloseMinimal: false,
    outWay: true,
    miniMalWidth: '550px',
    miniMalHeight: '90%',
    malThumbnail: 100,
    friendScore: true,
    loadPTWForProgress: false,

    quicklinks: [
      'Crunchyroll',
      'Mangadex',
      'MangaNato',
      'MangaFox',
      'MangaSee',
      'MangaFire',
      'HiAnime',
      'Hulu',
      'Netflix',
      'Hidive',
      'VIZ',
      'MangaPlus',
      'MangaReader',
      'ComicK',
      'WeebCentral',
      'KickAssAnime',
      'animepahe',
    ],
    quicklinksPosition: 'default',

    autofull: false,
    autoresume: false,
    autoNextEp: false,
    highlightAllEp: false,
    checkForFiller: true,
    crashReport: true,

    introSkip: 85,
    introSkipFwd: [17, 39],
    introSkipBwd: [17, 37],
    nextEpShort: [],
    correctionShort: [67],
    syncShort: [],

    progressInterval: 120,
    progressIntervalDefaultAnime: 'en/sub',
    progressIntervalDefaultManga: 'en/sub',
    progressNotificationsAnime: true,
    progressNotificationsManga: true,
    notificationsSticky: true,

    bookMarksList: false,
    bookMarksListManga: false,

    customDomains: [],

    anilistUpdateUi: true,

    anilistToken: '',
    anilistOptions: {
      displayAdultContent: true,
      scoreFormat: 'POINT_10',
    },
    kitsuToken: '',
    kitsuOptions: {
      titleLanguagePreference: 'canonical',
      sfwFilter: false,
      ratingSystem: 'regular',
    },
    simklToken: '',

    malToken: '',
    malRefresh: '',

    shikiToken: '',
    shikiOptions: {
      locale: 'ru',
    },
  }),

  debounceArray: {},

  chibiList: {} as PageListJsonInterface['pages'],

  isInit: ref(false),

  async init() {
    const tempSettings = [];
    for (const key in this.options) {
      const store = await api.storage.get(`settings/${key}`);
      if (typeof store !== 'undefined') {
        this.options[key] = store;
        tempSettings[key] = /(token|refresh)/i.test(key) && store ? '********' : store;
      }
    }

    try {
      const chibiRepo = await ChibiListRepository.getInstance(true).init();
      this.chibiList = chibiRepo.getList();
    } catch (e) {
      con.error('Error loading chibi repo', e);
    }

    con.log('Settings', tempSettings);

    let rateDebounce;

    api.storage.storageOnChanged((changes, namespace) => {
      if (namespace === 'sync') {
        for (const key in changes) {
          const storageChange = changes[key];
          if (/^settings\//i.test(key)) {
            this.options[key.replace('settings/', '')] = storageChange.newValue;
            con.info(`Update ${key} option to ${JSON.stringify(storageChange.newValue, null, 2)}`);
          }
        }
      }
      if (namespace === 'local' && changes.rateLimit) {
        try {
          clearTimeout(rateDebounce);
          if (changes.rateLimit.newValue) {
            con.log('Rate limited');
            if (!$('.type-rate').length) {
              utils.flashm('Rate limited. Retrying in a moment', {
                error: true,
                type: 'rate',
                permanent: true,
              });
            }
          } else {
            rateDebounce = setTimeout(() => {
              con.log('No Rate limited');
              $('.type-rate').remove();
            }, 5000);
          }
        } catch (e) {
          con.error(e);
        }
      }
    });

    this.isInit.value = true;

    return this;
  },

  get(name: string) {
    if (!this.isInit.value) throw 'Settings not initialized';
    return this.options[name];
  },

  set(name: string, value: any) {
    if (!Object.prototype.hasOwnProperty.call(this.options, name)) {
      const err = Error(`${name} is not a defined option`);
      con.error(err);
      throw err;
    }

    this.options[name] = value;
    return api.storage.set(`settings/${name}`, value);
  },

  setDebounce(name: string, value: any) {
    this.options[name] = value;
    clearTimeout(this.debounceArray[name]);
    this.debounceArray[name] = setTimeout(() => {
      this.set(name, value);
      delete this.debounceArray[name];
    }, 1000);
  },

  async getAsync(name: string) {
    const value = await api.storage.get(`settings/${name}`);
    if (typeof value === 'undefined' && typeof this.options[name] !== 'undefined')
      return this.options[name];
    return value;
  },

  getStaticChibi(): PageListJsonInterface['pages'] {
    if (!this.isInit.value) throw 'Settings not initialized';
    return this.chibiList;
  },
};
