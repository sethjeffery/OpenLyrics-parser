import { XMLBuilder, XMLParser } from 'fast-xml-parser';

import { Builder } from './builder';
import { IBuilderOptions } from './builder.model';
import { IBuilderXml } from './builder.xml.model';
import { Parser } from './parser';
import { IParserRoot } from './parser.model';
import { IXmlDocRoot } from './parser.xml.model';

export * from './parser.model';
export const OpenLyricsParser = (fileContent: string): IParserRoot => {
  //When certain XML nodes only have one item the parser will convert them into objects
  //Here we maintain a list of node paths to always keep as arrays
  //This keeps our code structure and type definitions more sane and normalized
  const alwaysArray = [
    'song.properties.titles.title',
    'song.properties.titles.title.text',
    'song.properties.authors.author',
    'song.properties.comments.comment',
    'song.properties.songbooks.songbook',
    'song.properties.themes.theme',
    'song.lyrics.verse',
    'song.lyrics.verse.lines',
    'song.lyrics.instrument',
    'song.lyrics.instrument.lines',
  ];

  const xmlParser = new XMLParser({
    //https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/docs/v4/2.XMLparseOptions.md
    ignoreAttributes: false,
    ignoreDeclaration: true,
    attributeNamePrefix: '',
    parseTagValue: true,
    parseAttributeValue: true,
    //the XML parser doesn't deal with `<br>` tags very well, so we need to stop parsing
    //when we get to the verse lines and then deal with this separately
    stopNodes: ['song.lyrics.verse.lines', 'song.lyrics.instrument.lines'],
    isArray: (_name, jPath: string): boolean => alwaysArray.includes(jPath),
    tagValueProcessor: (_tagName, tagValue, jPath): string | boolean | null => {
      //console.log(`<${_tagName}> at path: "${jPath}"`, '\n' + tagValue);
      if (jPath === 'song.lyrics.verse.lines') {
        //Inside of a verse line...
        return (
          tagValue
            //replace all correctly and incorrectly formatted <br> <br/> <br /> and </br> tags with new lines
            //Sometimes these will already have a newline after them, remove that so that newlines aren't doubled
            .replace(/<\/?br ?\/?>([\r\n])?/gi, '\n')
            //Remove all XML/HTML comments
            .replace(/<!--.+?-->/g, '')
        );
      }
      //return everything else as is
      return null;
    },
  });

  const parsedDoc: IXmlDocRoot = xmlParser.parse(fileContent);
  const olParser = new Parser();

  const meta = olParser.getSongMeta(parsedDoc.song);
  const properties = olParser.getSongProperties(parsedDoc.song.properties);
  const format = olParser.getSongFormat(parsedDoc.song.format);
  const verses = olParser.getSongVerses(parsedDoc.song.lyrics.verse);
  const instruments = olParser.getSongInstruments(parsedDoc.song.lyrics.instrument);

  return {
    meta,
    properties,
    format,
    verses,
    instruments,
  };
};

export * from './builder.model';
export const OpenLyricsBuilder = (songData: IBuilderOptions): string => {
  //Certain items are required: https://docs.openlyrics.org/en/latest/dataformat.html#required-data-items
  const olBuilder = new Builder();

  const documentObj: IBuilderXml = {
    '?xml': {
      '@version': '1.0',
      '@encoding': 'UTF-8',
    },
    '?xml-stylesheet': {
      '@href': '../stylesheets/openlyrics.css',
      '@type': 'text/css',
    },
    song: {
      //Any properties here with empty strings will be overwritten
      '@xmlns': 'http://openlyrics.info/namespace/2009/song',
      '@xml:lang': '',
      '@version': '0.9',
      '@createdIn': '',
      '@modifiedIn': '',
      '@modifiedDate': '',
      properties: {
        titles: { title: [] },
      },
      format: {},
      lyrics: {
        verse: [],
      },
    },
  };

  //Overwrite any information with either a default value or what the user passed in
  olBuilder.overwriteMeta(documentObj, songData.meta);
  olBuilder.overwriteProperties(documentObj, songData.properties);
  olBuilder.overwriteFormats(documentObj, songData.format);
  olBuilder.overwriteVerses(documentObj, songData.verses);
  olBuilder.overwriteInstruments(documentObj, songData.instruments);

  const builder = new XMLBuilder({
    attributeNamePrefix: '@',
    format: true,
    ignoreAttributes: false,
    processEntities: false,
    suppressBooleanAttributes: false,
    suppressUnpairedNode: false,
    unpairedTags: ['songbook'],
  });
  const xmlString = builder.build(documentObj).trim();

  return xmlString;
};
