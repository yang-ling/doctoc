A fork of DocToc that does not add "generated with DocToc" to every single frickin' table of contents. [Cherry pick from this repo](https://github.com/coryfklein/doctoc)

Also add gitlab mode. [Cherry pick from this repo](https://github.com/jingege/doctoc)

Because gitlab cannot hide comments, I changed matching `start` and `end`

`start` is
```
**Table of Contents starts from here**
```

`end` is
```
**Table of Contents ends at here**
```
