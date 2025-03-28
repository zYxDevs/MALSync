import { MetaOverviewAbstract } from '../metaOverviewAbstract';
import { UrlNotSupportedError } from '../Errors';
import { dateFromTimezoneToTimezone, getWeektime } from '../../utils/time';
import { IntlDateTime, IntlDuration, IntlRange } from '../../utils/IntlWrapper';

export class MetaOverview extends MetaOverviewAbstract {
  constructor(url) {
    super(url);
    this.logger = this.logger.m('MAL');
    if (url.match(/myanimelist\.net\/(anime|manga)\/\d*/i)) {
      this.type = utils.urlPart(url, 3) === 'anime' ? 'anime' : 'manga';
      this.malId = Number(utils.urlPart(url, 4));
      return this;
    }
    throw new UrlNotSupportedError(url);
  }

  protected readonly type;

  private readonly malId: number;

  async _init() {
    this.logger.log('Retrieve', this.type, `MAL: ${this.malId}`);

    const data = await this.getData();
    // this.logger.log('Data', data);

    this.title(data);
    this.description(data);
    this.image(data);
    this.alternativeTitle(data);
    this.characters(data);
    this.statistics(data);
    this.info(data);
    this.openingSongs(data);
    this.endingSongs(data);
    this.related(data);

    this.logger.log('Res', this.meta);
  }

  private async getData() {
    return api.request
      .xhr('GET', `https://myanimelist.net/${this.type}/${this.malId}`)
      .then(response => {
        return response.responseText;
      });
  }

  private title(data) {
    let title = '';

    const useAltTitle = api.settings.get('forceEnglishTitles');

    try {
      if (useAltTitle) {
        title = data
          .split('class="title-english')[1]
          .split('>')[1]
          .split('</')[0]
          .split('<br')[0]
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'");
      } else {
        title = data
          .split('itemprop="name">')[1]
          .split('</')[0]
          .split('<br')[0]
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'");
      }
    } catch (e) {
      console.log('[iframeOverview] Error:', e);
    }
    this.meta.title = $('<div>').html(j.html(title)).text();
  }

  private description(data) {
    let description = '';
    try {
      description = data.split('itemprop="description">')[1].split('</p')[0].split('</span')[0];
    } catch (e) {
      console.log('[iframeOverview] Error:', e);
    }
    this.meta.description = description;
  }

  private image(data) {
    let image = '';
    let imageLarge = '';
    try {
      image = data.split('property="og:image"')[1].split('content="')[1].split('"')[0];
      if (image) {
        const ending = image.split('.').pop();
        imageLarge = image.replace(`.${ending}`, `l.${ending}`);
      }
    } catch (e) {
      console.log('[iframeOverview] Error:', e);
    }
    this.meta.image = image;
    this.meta.imageLarge = imageLarge ?? image;
  }

  private alternativeTitle(data) {
    let altTitle: any[] = [];

    try {
      const tempHtml = j.$.parseHTML(
        `<div>${data.split('<h2>Alternative Titles</h2>')[1].split('<h2>')[0]}</div>`,
      );
      altTitle = j
        .$(tempHtml)
        .find('.spaceit_pad')
        .toArray()
        .map(function (i) {
          return utils.getBaseText(j.$(i)).trim();
        });
    } catch (e) {
      console.log('[iframeOverview] Error:', e);
    }

    this.meta.alternativeTitle = altTitle;
  }

  private characters(data) {
    const charArray: any[] = [];
    try {
      const characterBlock = data.split('detail-characters-list')[1].split('</h2>')[0];
      const charHtml = j.$.parseHTML(`<div class="detail-characters-list ${characterBlock}`);

      j.$.each(j.$(charHtml).find(':not(td) > table'), (index, value) => {
        const regexDimensions = /\/r\/\d*x\d*/g;
        let charImg = j.$(value).find('img').first().attr('data-src');
        if (charImg && regexDimensions.test(charImg)) {
          charImg = charImg.replace(regexDimensions, '');
        } else {
          charImg = '';
        }

        charImg = utils.handleMalImages(charImg);

        const charObjLink = j.$(value).find('.borderClass .spaceit_pad').first().parent();

        charArray.push({
          img: charImg,
          name: charObjLink.find('a').first().text(),
          url: charObjLink.find('a').first().attr('href'),
          subtext: charObjLink.find('.spaceit_pad').first().text().trim(),
        });
      });
    } catch (e) {
      console.log('[iframeOverview] Error:', e);
    }
    this.meta.characters = charArray;
  }

  private statistics(data) {
    const stats: any[] = [];
    try {
      const statsBlock = data.split('<h2>Statistics</h2>')[1].split('<h2>')[0];
      // @ts-ignore
      const tempHtml = j.$.parseHTML(statsBlock);
      const This = this;
      j.$.each(j.$(tempHtml).filter('div').slice(0, 5), function (index, value) {
        const title = j.$(value).find('.dark_text').text();
        const body =
          typeof j.$(value).find('span[itemprop=ratingValue]').height() !== 'undefined'
            ? j.$(value).find('span[itemprop=ratingValue]').text()
            : j.$(value).clone().children().remove().end().text();
        stats.push({
          title: This.translateTitle(title),
          body: body.trim(),
        });
      });
    } catch (e) {
      console.log('[iframeOverview] Error:', e);
    }
    this.meta.statistics = stats;
  }

  private info(data) {
    const html: any[] = [];
    try {
      const infoBlock = data.split('<h2>Information</h2>')[1].split('<h2>')[0];
      const infoData = j.$.parseHTML(infoBlock);
      j.$.each(j.$(infoData).filter('div'), (index, value) => {
        let title = j.$(value).find('.dark_text').text();
        j.$(value).find('.dark_text').remove();

        const aTags: { text: string; url: string; subtext?: string }[] = j
          .$(value)
          .find('a')
          .map((i, el) => {
            return {
              text: j.$(el).text().trim(),
              url: utils.absoluteLink(j.$(el).attr('href'), 'https://myanimelist.net'),
            };
          })
          .toArray();

        j.$(value).find('a, span').remove();

        const textTags = j.$(value).text().split(',');

        let body: any[] = [];

        if (!aTags.length) {
          body = textTags.map(el => {
            const match = el.match(/(\w+)\s+at\s+(\d{2}:\d{2})\s+\(JST\)/i);

            if (match) {
              const dayString = match[1];
              const timeString = match[2];

              const weekDate = getWeektime(dayString, timeString);
              if (weekDate) {
                const broadcastDate = dateFromTimezoneToTimezone(weekDate, 'Asia/Tokyo');
                return {
                  date: broadcastDate,
                  type: 'weektime',
                };
              }
            }

            return {
              text: el.trim(),
            };
          });
        } else if (aTags.length === textTags.length) {
          body = aTags.map((el, i) => {
            el.subtext = textTags[i]
              .trim()
              .replace(/(^\(|\)$)/gi, '')
              .trim();
            return el;
          });
        } else {
          body = aTags;
        }
        switch (title.trim()) {
          case 'Published:':
          case 'Aired:': {
            title =
              title === 'Published:'
                ? api.storage.lang('overview_sidebar_Published')
                : api.storage.lang('overview_sidebar_Aired');
            const range = body.map(e => e.text.toString()).toString();
            // NOTE - For anime/continuous aired titles with start and end date
            if (range.includes(' to ')) {
              const start = range.split('to')[0].trim();
              const end = range.split('to')[1].trim();
              const rangeDate = new IntlRange(start, end).getDateTimeRangeText();
              body = [{ text: rangeDate }];
              break;
            }
            // NOTE - For movies/titles with only 1 air date
            body = [{ text: `${new IntlDateTime(range).getDateTimeText()}` }];
            break;
          }
          case 'Duration:': {
            title = api.storage.lang('overview_sidebar_Duration');
            const durationString: string = body[0].text;
            const match = durationString.match(/\d+/g);
            // NOTE - For anime with episodes
            if (match) {
              if (durationString.includes('min') && match.length === 1) {
                const minutes = Number(match[0]);
                const result = new IntlDuration()
                  .setDurationFormatted({ minutes })
                  .getRelativeText();
                body = [{ text: `${result}` }];
                break;
              }
              // NOTE - For movies with total duration
              const hours = Number(match[0]) || 0;
              const minutes = Number(match[1]) || 0;
              const result = new IntlDuration().setDuration({ hours, minutes }).getRelativeText();
              body = [{ text: `${result}` }];
              break;
            }
          }
          default:
            break;
        }
        title = this.translateTitle(title);
        html.push({
          title,
          body,
        });
      });
      this.getExternalLinks(html, data);
    } catch (e) {
      console.log('[iframeOverview] Error:', e);
    }
    this.meta.info = html;
  }

  translateTitle(title: string) {
    const clearTitle = title.replace(':', '').trim();
    const titleTranslated = api.storage.lang(`overview_sidebar_${clearTitle}`);
    return titleTranslated || title;
  }

  getExternalLinks(html, data) {
    try {
      const infoBlock = `${data.split('<h2>External Links</h2>')[1].split('</div>')[0]}</div>`;
      const infoData = j.$.parseHTML(infoBlock);

      const body: any[] = [];
      j.$.each(j.$(infoData).find('a'), (index, value) => {
        body.push({
          text: j.$(value).text(),
          url: j.$(value).attr('href'),
        });
      });
      if (body.length) {
        html.push({
          title: `${api.storage.lang('overview_sidebar_external_links')}`,
          body,
        });
      }
    } catch (e) {
      console.log('[iframeOverview] Error:', e);
    }
  }

  openingSongs(data) {
    const openingSongs: {
      title: string;
      author: string;
      episode: string;
      url?: string;
    }[] = [];

    try {
      const openingBlock = `<table border${
        data.split('opnening">')[1].split('<table border')[1].split('</table>')[0]
      }</table>`;
      const openingData = j.$(j.$.parseHTML(openingBlock));
      if (openingData.find('td').length > 1) {
        openingData.find('tr').each((_, el) => {
          let title = $(el).find('.theme-song-title').text().trim();

          if (!title) {
            title = utils.getBaseText($(el).find('[id^="youtube_url_"]').parent()).trim();
          }

          let url = $(el).find('[id^="youtube_url_"]').first().attr('value')?.replace('music.', '');

          if (!url) {
            url = $(el).find('[id^="spotify_url_"]').first().attr('value');
          }

          openingSongs.push({
            title: title.replace(/(^"|"$)/g, ''),
            author: $(el).find('.theme-song-artist').text().trim(),
            episode: $(el)
              .find('.theme-song-episode')
              .text()
              .trim()
              .replace(/(^\(|\)$)/g, ''),
            url,
          });
        });
      }
    } catch (e) {
      console.log('[iframeOverview] Error:', e);
    }

    this.meta.openingSongs = openingSongs;
  }

  endingSongs(data) {
    const endingSongs: {
      title: string;
      author: string;
      episode: string;
      url?: string;
    }[] = [];

    try {
      const endingBlock = `<table border${
        data.split(' ending">')[1].split('<table border')[1].split('</table>')[0]
      }</table>`;

      const endingData = j.$(j.$.parseHTML(endingBlock));
      if (endingData.find('td').length > 1) {
        endingData.find('tr').each((_, el) => {
          let title = $(el).find('.theme-song-title').text().trim();

          if (!title) {
            title = utils.getBaseText($(el).find('[id^="youtube_url_"]').parent()).trim();
          }

          let url = $(el).find('[id^="youtube_url_"]').first().attr('value')?.replace('music.', '');

          if (!url) {
            url = $(el).find('[id^="spotify_url_"]').first().attr('value');
          }

          endingSongs.push({
            title: title.replace(/(^"|"$)/g, ''),
            author: $(el).find('.theme-song-artist').text().trim(),
            episode: $(el)
              .find('.theme-song-episode')
              .text()
              .trim()
              .replace(/(^\(|\)$)/g, ''),
            url,
          });
        });
      }
    } catch (e) {
      console.log('[iframeOverview] Error:', e);
    }

    this.meta.endingSongs = endingSongs;
  }

  private related(data) {
    const el: { type: string; links: any[] }[] = [];
    try {
      const relatedBlock = data.split('Related ')[1].split('</h2>')[1].split('<h2>')[0];
      const related = j.$.parseHTML(relatedBlock);

      j.$.each(
        j.$(related).filter('.related-entries').find('.entry .content'),
        function (index, value) {
          const links: { url: string; title: string; type: string; id: number }[] = [];
          j.$(value)
            .find('a')
            .each(function (indexB, valueB) {
              const url =
                utils.absoluteLink(j.$(valueB).attr('href'), 'https://myanimelist.net') || '';
              if (url) {
                links.push({
                  url,
                  title: j.$(valueB).parent().text(),
                  type: utils.urlPart(url, 3),
                  id: Number(utils.urlPart(url, 4)),
                });
              }
            });
          el.push({
            type: j
              .$(value)
              .find('.relation')
              .first()
              .text()
              .trim()
              .replace(/\(.*\)$/gi, ''),
            links,
          });
        },
      );

      j.$.each(j.$(related).filter('.related-entries').find('table tr'), function (index, value) {
        const links: { url: string; title: string; type: string; id: number }[] = [];
        j.$(value)
          .find('.borderClass')
          .last()
          .find('a')
          .each(function (indexB, valueB) {
            const url =
              utils.absoluteLink(j.$(valueB).attr('href'), 'https://myanimelist.net') || '';
            if (url) {
              links.push({
                url,
                title: j.$(valueB).parent().text(),
                type: utils.urlPart(url, 3),
                id: Number(utils.urlPart(url, 4)),
              });
            }
          });
        el.push({
          type: j.$(value).find('.borderClass').first().text(),
          links,
        });
      });
    } catch (e) {
      console.log('[iframeOverview] Error:', e);
    }
    this.meta.related = el;
  }
}
