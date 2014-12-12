'use strict';

var _             = require('underscore')
  , anchor        = require('anchor-markdown-header')
  , updateSection = require('update-section')
  , getHtmlHeaders = require('./get-html-headers');

var start = '<!-- START doctoc generated TOC please keep comment here to allow auto update -->\n' +
            '<!-- DON\'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->'
  , end   = '<!-- END doctoc generated TOC please keep comment here to allow auto update -->'
  , startForGitlab = '**Table of Contents starts from here**\n'
  , endForGitlab = '**Table of Contents ends at here**';
  var theMode;

function matchesStart(line) {
  return (/<!-- START doctoc generated TOC /).test(line);
}

function matchesEnd(line) {
  return (/<!-- END doctoc generated TOC /).test(line);
}

function matchesStartForGitlab(line) {
  return (/^\*\*Table of Contents starts from here\*\*/).test(line);
}

function matchesEndForGitlab(line) {
  return (/^\*\*Table of Contents ends at here\*\*/).test(line);
}

function notNull(x) { return  x !== null; }

function addAnchor(mode, header) {
  header.anchor = anchor(header.name, mode, header.instance);
  return header;
}


function getHashedHeaders (lines) {
  var inCodeBlock = false
    , lineno = 0;

  // Turn all headers into '## xxx' even if they were '## xxx ##'
  function normalize(header) {
    return header.replace(/[ #]+$/, '');
  }

  // Find headers of the form '### xxxx xxx xx [###]'
  return lines
    .map(function (x, idx) {
      return { lineno: idx, line: x }
    })
    .filter(function (x) {
      if (x.line.match(/^```/)) {
        inCodeBlock = !inCodeBlock;
      }
      return !inCodeBlock;
    })
    .map(function (x) {
      var match = /^(\#{1,8})[ ]*(.+)\r?$/.exec(x.line);

      return match
        ? { rank :  match[1].length
          , name :  normalize(match[2])
          , line :  x.lineno
          }
        : null;
    })
    .filter(notNull)
}

function getUnderlinedHeaders (lines) {
    // Find headers of the form
    // h1       h2
    // ==       --

    return lines
      .map(function (line, index, lines_) {
        if (index === 0) return null;
        var rank;

        if (/^==+ *\r?$/.exec(line))      rank = 1;
        else if (/^--+ *\r?$/.exec(line)) rank = 2;
        else                              return null;

        return {
          rank  :  rank,
          name  :  lines_[index - 1],
          line  :  index - 1
        };
      })
      .filter(notNull)
}

function countHeaders (headers) {
  var instances = {};

  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    var name = header.name;

    if (instances.hasOwnProperty(name)) {
      instances[name]++;
    } else {
      instances[name] = 0;
    }

    header.instance = instances[name];
  }

  return headers;
}

function getLinesToToc (lines, currentToc, info) {
  if (!currentToc) return lines;

  var tocableStart = 0;

  // when updating an existing toc, we only take the headers into account
  // that are below the existing toc
  if (info.hasEnd) tocableStart = info.endIdx;

  return lines.slice(tocableStart);
}

exports = module.exports = function transform(content, mode, maxHeaderNo) {
  mode = mode || 'github.com';
  theMode = mode;
  if (mode === 'gitlab.com') {
      // This is because currently anchor-markdown-header cannot recognize gitlab mode
      // This is temporarily fix. It should be removed after anchor-markdown-header supports
      // gitlab mode
      mode = 'github.com'
  }
  maxHeaderNo = maxHeaderNo || 4;

  var lines = content.split('\n'), info;

  if (theMode === 'gitlab.com') {
      info = updateSection.parse(lines, matchesStartForGitlab, matchesEndForGitlab);
  } else {
      info = updateSection.parse(lines, matchesStart, matchesEnd);
  }

  var currentToc = info.hasStart && lines.slice(info.startIdx, info.endIdx).join('\n')
    , linesToToc = getLinesToToc(lines, currentToc, info);

  var headers = getHashedHeaders(linesToToc)
    .concat(getUnderlinedHeaders(linesToToc))
    .concat(getHtmlHeaders(linesToToc, maxHeaderNo))

  headers.sort(function (a, b) {
    return a.line - b.line;
  });

  var allHeaders    =  countHeaders(headers)
    , lowestRank    =  _(allHeaders).chain().pluck('rank').min().value()
    , linkedHeaders =  _(allHeaders).map(addAnchor.bind(null, mode));

  if (linkedHeaders.length === 0) return { transformed: false };

  var toc;
  if (theMode === 'gitlab.com') {
      toc =
          linkedHeaders
          .map(function (x) {
              var indent = _(_.range(x.rank - lowestRank))
                  .reduce(function (acc, x) { return acc + '  '; }, '');
              return indent + '- ' + x.anchor;
          })
      .join('\n')
          + '\n';
  } else {
      toc =
          '**Table of Contents**'
          + '\n\n'
          + linkedHeaders
          .map(function (x) {
              var indent = _(_.range(x.rank - lowestRank))
                  .reduce(function (acc, x) { return acc + '  '; }, '');
              return indent + '- ' + x.anchor;
          })
      .join('\n')
          + '\n';
  }

  var wrappedToc;
  if (theMode === 'gitlab.com') {
      wrappedToc =  startForGitlab + '\n' + toc + '\n' + endForGitlab;
  } else {
      wrappedToc =  start + '\n' + toc + '\n' + end;
  }

  if (currentToc === toc) return { transformed: false };

  var data;
  if (theMode === 'gitlab.com') {
      data = updateSection(lines.join('\n'), wrappedToc, matchesStartForGitlab, matchesEndForGitlab, true);
  } else {
      data = updateSection(lines.join('\n'), wrappedToc, matchesStart, matchesEnd, true);
  }
  return { transformed : true, data : data, toc: toc, wrappedToc: wrappedToc };
};

if (theMode === 'gitlab.com') {
    exports.start = startForGitlab;
    exports.end = endForGitlab;
} else {
    exports.start = start;
    exports.end = end;
}
