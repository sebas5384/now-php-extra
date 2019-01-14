# now-php-extra

A Now 2.0 builder for complicated PHP projects which need extra extensions (than
the `@now/php` builder) like `gd`, `pdo` or `dom` and supports Composer.

## How to use it

Create a `info.php` file:

```php
<?php phpinfo(); ?>
```

Create a `now.json` like:

```json
{
  "version": 2,
  "builds": [{ "src": "*.php", "use": "now-php-extra" }]
}
```

After running `now`, you'll get a result like this:
https://now-php-extra-project-fwjp5iv98.now.sh/info.php

### With Composer

Install [Cowsayphp](https://github.com/alrik11es/cowsayphp) package via Composer:

```
$ composer require alrik11es/cowsayphp
```

Create a `index.php` file:

```php
<?php
require __DIR__ . '/vendor/autoload.php';

use Cowsayphp\Farm;

$cow = Farm::create(\Cowsayphp\Farm\Cow::class);
echo '<pre>' . $cow->say("Ohmg I'm a cow on Now 2.0!") . '</pre>';
```

Create a `.nowignore` file:

```
vendor
```

Result: https://now-php-extra-project-fwjp5iv98.now.sh

## Technical Details

### Entrypoint

The entrypoint file must be a `.php` source file.

### Version

- PHP 7.1 which includes `php-cli` and `php-fpm`.
- Composer 1.8.0 by default.

### Default configuration

In the majority of cases you shouldn't need to override the `config` properties.

```json
{
  "version": 2,
  "builds": [
    {
      "src": "*.php",
      "use": "now-php-extra",
      "config": {
        "composerVersion": "1.8.0",
        "composerJson": "composer.json",
        "documentRoot": "",
        "staticRegexps": [
          "/.css$/",
          "/.gif$/",
          "/.ico$/",
          "/.js$/",
          "/.jpg$/",
          "/.png$/",
          "/.svg$/",
          "/.woff$/",
          "/.woff2$/"
        ]
      }
    }
  ]
}
```

### Maximum Lambda Bundle Size

To help keep cold boot times low, the maximum output bundle size for a PHP lambda is, by default, `10mb`.

This limit is [extendable](https://zeit.co/docs/v2/deployments/builders/overview/#configuring-output-lambda-size) up to `50mb`.

## Disclaimer

Inspired by [@php/now](https://zeit.co/docs/v2/deployments/official-builders/php-now-php) package.
