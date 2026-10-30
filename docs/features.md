# Features

<!-- Generated from the behaviour specs (src/**/*.feature) by `npm run docs:features`: don't edit by hand. -->

What the app does, scenario by scenario. Every scenario runs as a test (jest-cucumber), so this page only describes behaviour that is checked.

- [A recipe from a document](#a-recipe-from-a-document): 5 scenarios
- [A recipe from a photo](#a-recipe-from-a-photo): 10 scenarios
- [A recipe's photo and times](#a-recipes-photo-and-times): 3 scenarios
- [About](#about): 2 scenarios
- [Drinks](#drinks): 5 scenarios
- [In a browser](#in-a-browser): 4 scenarios
- [Ingredient quantities](#ingredient-quantities): 3 scenarios
- [Ingredients](#ingredients): 2 scenarios
- [Loading screen](#loading-screen): 3 scenarios
- [Meal choice](#meal-choice): 6 scenarios
- [Meal history](#meal-history): 8 scenarios
- [On a TV](#on-a-tv): 4 scenarios
- [Recipe list](#recipe-list): 11 scenarios
- [Recipes](#recipes): 6 scenarios
- [Server sync](#server-sync): 10 scenarios
- [Sharing a recipe](#sharing-a-recipe): 2 scenarios
- [Shopping list](#shopping-list): 12 scenarios

## A recipe from a document

Choose a file (when adding a recipe or a drink) also takes documents: a PDF, a Word document (.docx), an OpenDocument text (.odt) or a text file (.txt). Everything is read on the phone, nothing is sent nor kept: a PDF's pages are drawn as images (Android's own PDF renderer) and read by the same text recognition as photos, one page after the other, up to 5 pages; the other documents are read directly, their title found by its style or size (a text file's first line). The title, the ingredients and the steps then fill in the form, as from a photo.

### A PDF fills in a new recipe, page after page

- **When** I fill in a new recipe from a PDF whose first page has "Tarte aux pommes" and "3 pommes" and its second page "Cuire 30 min."
- **Then** the new recipe opens filled in with "Tarte aux pommes", "Pommes: 3" and "Cuire 30 min."
- **And** the PDF's page images are deleted

### Only the first 5 pages of a long PDF are read

- **When** I fill in a new recipe from a PDF of 8 pages
- **Then** only its first 5 pages are read
- **And** I am told that only its first 5 pages were read

### A document fills in a new recipe

- **When** I fill in a new recipe from <document> "Soupe de poireaux" listing "2 poireaux" then "Mixer."
- **Then** the new recipe opens filled in with "Soupe de poireaux", "Poireaux: 2" and "Mixer."

**With each of:**

| document             |
| -------------------- |
| a Word document      |
| an OpenDocument text |
| a text file          |

### An old Word document can't be read

- **When** I choose the file "Recette.doc" for a new recipe
- **Then** I am told to save it as .docx first
- **And** no recipe form opens

### A PDF that can't be opened

- **When** I choose a PDF protected by a password for a new recipe
- **Then** I am told that the file couldn't be read
- **And** the copies of the file are deleted

## A recipe from a photo

Adding a recipe asks whether to write it or to fill it in from a photo of a recipe page, taken with the camera (cropped to the recipe) or chosen with Choose a file, which also takes documents (see "A recipe from a document"). The text is read on the phone: the photo is neither sent nor kept (the copies the pickers make in the app's cache are deleted once read, even when the reading fails). The title, the ingredients with their quantities and the steps fill in the form, to check before saving. An ingredient that already exists (same name, ignoring case) is used; a new one is only created when the recipe is saved. When a new one looks like an existing one (singular or plural, other accents: "carrot" and "Carrots"), or contains one ("bouteille de vin rouge" and "Vin rouge"), its row asks which to keep, and the recipe can't be saved until the user chooses.

### Adding a recipe asks how to start

- **When** I add a recipe from the recipe list
- **Then** I am asked whether to write it, choose a file or take a photo
- **When** I choose a photo of "Leek soup" listing "2 leeks"
- **Then** the new recipe opens filled in with "Leek soup" and "Leeks: 2"

### A photo fills in a new recipe

- **Given** the ingredients "Leek" exist
- **When** I fill in a new recipe from a photo of "Leek soup" listing "2 leek, 500 g potatoes"
- **Then** the new ingredient "Potatoes" is listed with a capital first letter
- **When** I save the recipe
- **Then** the recipe "Leek soup" lists "Leek: 2, Potatoes: 500 g"
- **And** the ingredients are "Leek, Potatoes"

### New ingredients are only created when the recipe is saved

- **When** I fill in a new recipe from a photo of "Leek soup" listing "2 leeks"
- **Then** no ingredient exists yet

### An ingredient like an existing one asks which to keep

- **Given** the ingredients "Carrots" exist
- **When** I fill in a new recipe from a photo of "Carrot salad" listing "3 carrot"
- **Then** I am told I already have "Carrots"
- **When** I save the recipe
- **Then** I am asked to choose before saving
- **And** no recipe is saved
- **When** I use "Carrots"
- **And** I save the recipe
- **Then** the recipe "Carrot salad" lists "Carrots: 3"
- **And** the ingredients are "Carrots"

### A read name containing an existing ingredient asks too

- **Given** the ingredients "Vin rouge" exist
- **When** I fill in a new recipe from a photo of "Bœuf bourguignon" listing "1 bouteille de vin rouge"
- **Then** I am told I already have "Vin rouge"

### The new ingredient can be kept

- **Given** the ingredients "Carrots" exist
- **When** I fill in a new recipe from a photo of "Carrot salad" listing "3 carrot"
- **And** I keep the new "Carrot"
- **And** I save the recipe
- **Then** the recipe "Carrot salad" lists "Carrot: 3"
- **And** the ingredients are "Carrot, Carrots"

### The camera needs my permission

- **Given** I refuse the camera
- **When** I try to take a photo for a new recipe
- **Then** I am told to allow the camera or to choose a file

### A photo without text

- **When** I fill in a new recipe from a photo without text
- **Then** I am told that no recipe was found

### The photo isn't kept

- **When** I fill in a new recipe from a photo of "Leek soup" listing "2 leeks"
- **Then** the copies of the photo are deleted

### The photo isn't kept when it can't be read

- **When** the photo I choose for a new recipe can't be read
- **Then** I am told that the photo couldn't be read
- **And** the copies of the photo are deleted

## A recipe's photo and times

A recipe can have a photo and its preparation and cooking times (minutes). The photo is taken or picked from the gallery in the form, cropped, and saved resized (1280 px on its long side); removing it asks first. Both show on the recipe's page, on the meal choice's card and in the shared PDF, and sync with the server like the rest of the recipe. Read-only on a TV.

### The times are written in the form and shown on the recipe

- **Given** I am writing a new recipe "Leek soup"
- **When** I give it 15 minutes of preparation and 30 of cooking
- **And** I save the recipe
- **Then** the recipe shows "Preparation 15 min · Cooking 30 min · 45 min in all"

### A time that isn't a number of minutes is refused

- **Given** I am writing a new recipe "Leek soup"
- **When** I give it "a while" of preparation
- **And** I save the recipe
- **Then** I'm asked for a number of minutes
- **And** the recipe isn't saved

### A photo is added from the gallery, and removed after confirming

- **Given** the recipe "Leek soup" exists
- **When** I edit it and add a photo from the gallery
- **And** I save the recipe
- **Then** the recipe shows its photo
- **When** I edit it and remove the photo
- **And** I confirm the removal
- **And** I save the recipe
- **Then** the recipe shows no photo

## About

The About page, in the menu, tells how the app handles your data: what stays on the device, what goes to your own sync server if you set one up, and that nothing is sent to anyone else. It also shows the app's version.

### The About page tells where my data goes

- **When** I open the About page
- **Then** I read what stays on this device
- **And** I read what goes to my own server, only if I choose to sync with it
- **And** I read that nothing is sent to anyone else
- **And** I see the app's version

### The About page speaks my language

- **Given** the app is in French
- **When** I open the About page
- **Then** I read "Sur cet appareil"

## Drinks

Drinks (cocktails, smoothies, hot drinks…) are written like recipes, with their ingredients, times and photo, but without a season nor a course nor a cooking time. A drink can have a maturation time instead (a liqueur, a flavoured wine), in months, which can be a fraction: it shows apart from the preparation time, on the drink's page, its PDF and the Drinks list. Drinks have their own list, Drinks in the menu, with the title search and the ingredient filter; Recipes lists the dishes only. The meal choice only suggests dishes, and drinks have no meal history, but a drink can be added to the shopping list from its page. They sync with the server like the dishes. Read-only on a TV.

### A drink is written without a season nor a course, and listed with the drinks only

- **Given** the dish "Leek soup" exists
- **When** I write a new drink "Mojito"
- **Then** the form asks for no season nor course
- **When** I save the drink
- **Then** Drinks lists "Mojito" only
- **And** Recipes lists "Leek soup" only

### A drink has a preparation and a maturation time, but no cooking time

- **When** I write a new drink "Limoncello"
- **Then** the form asks for a preparation and a maturation time but no cooking time
- **When** I give it 20 minutes of preparation and "1.5" months of maturation
- **And** I save the drink
- **Then** the drink shows "Preparation 20 min · Maturation 1.5 months"
- **And** Drinks shows "Maturation 1.5 months" on its row

### A maturation time is a number of months up to 24

- **When** I write a new drink "Limoncello"
- **And** I give it 20 minutes of preparation and "1.125" months of maturation
- **And** I save the drink
- **Then** the form says "Enter a number of months up to 24, like 0.5 or 2."

### The meal choice never suggests a drink

- **Given** the drink "Mojito" exists
- **Then** the meal choice has no recipe to suggest

### A drink's page has no season, no course and no meal history

- **Given** the drink "Mojito" exists
- **When** I open it
- **Then** it shows no season, no course and no "I cooked it"
- **And** it can be added to the shopping list

## In a browser

In a desktop browser, the web app, which the sync server serves, works like the phone's app without a camera: photos and recipe pages are files chosen on the computer. The About page says where a browser keeps the data.

### A new recipe is written or read from a file, without a camera

- **When** I start a new recipe in a browser
- **Then** I can write it or choose a file, not take a photo
- **And** I am told the file is read in the browser

### A recipe's photo is chosen among the computer's files right away

- **When** I add a photo to a recipe in a browser
- **Then** the file picker opens, without asking where the photo comes from

### The About page says where the browser keeps the data

- **When** I open the About page in a browser
- **Then** I am told my data is saved in this browser, which can clear it
- **And** I am told the sign-in token stays in this site's storage

### The sync server's address is the web app's

- **When** I set up the sync in a browser opened on "https://recipes.example.org"
- **Then** the server address is "https://recipes.example.org"

## Ingredient quantities

Each ingredient of a recipe can have a quantity: an amount and a unit, or a number of pieces. Weights are kept in grams and volumes in millilitres, and shown in the closest unit of the reader's units: Settings › Units, European (the default) or US. Spoons and counted units (pinch, clove…) stay as written.

### Quantities are given in the recipe form

- **Given** the ingredients "Carrot, Leek, Salt" exist
- **And** I am writing the recipe "Soup" with them
- **When** I give "Carrot" the quantity "0,5" in "kg"
- **And** I give "Leek" the quantity "2"
- **And** I save the recipe
- **Then** the recipe lists "Carrot: 500 g, Leek: 2, Salt"

### A quantity must be a number

- **Given** the ingredients "Carrot" exist
- **And** I am writing the recipe "Soup" with them
- **When** I give "Carrot" the quantity "a few"
- **And** I save the recipe
- **Then** I am asked for a number like 1.5 or 1/2
- **And** no recipe is saved

### A recipe written in US units is shown in my units

- **Given** a recipe "Cake" needs "8 oz" of "Flour" and "1 cup" of "Milk"
- **When** I read it with European units
- **Then** the recipe lists "Flour: 227 g, Milk: 237 ml"
- **When** I read it with US units
- **Then** the recipe lists "Flour: 8 oz, Milk: 1 cup"

## Ingredients

Each ingredient exists once and can be shared by many recipes.

### An ingredient is added once, whatever its case

- **Given** the ingredient list is open
- **When** I add the ingredient "Carrot"
- **And** I add the ingredient "carrot"
- **Then** I am told that "Carrot" already exists
- **And** the list contains only "Carrot"

### An ingredient used by a recipe cannot be deleted

- **Given** the recipe "Soup" made with "Leek"
- **And** the ingredient list is open
- **Then** "Leek" is used in 1 recipe
- **And** "Leek" cannot be deleted

## Loading screen

At startup, the app icon (its plate and cutlery, on its blue-grey background, over the whole screen) replaces the native splash screen, stays on screen for a moment, then fades into the app.

### The icon replaces the native splash screen

- **Given** the app is starting
- **When** the loading screen is laid out
- **Then** the native splash screen is hidden

### The app opens once the icon has been shown

- **Given** the app is starting
- **And** the icon is displayed
- **When** 1900 milliseconds have passed
- **Then** the loading screen is finished

### The app still opens when the icon fails to load

- **Given** the app is starting
- **And** the icon fails to load
- **When** 1900 milliseconds have passed
- **Then** the loading screen is finished

## Meal choice

The app proposes a random recipe of the chosen season and course (a main course by default), and another one on request. The recipe list narrows recipes down by ingredients too.

**For every scenario:**

- **Given** these recipes:

  | title        | season | course  |
  | ------------ | ------ | ------- |
  | Pumpkin soup | winter | main    |
  | Tomato salad | summer | starter |
  | Omelette     | both   | main    |
  | Ratatouille  | summer | main    |

### A main course is proposed as soon as the meal choice opens

- **When** I open the meal choice
- **Then** the suggestion is one of "Pumpkin soup, Omelette, Ratatouille"

### Choosing a season proposes a recipe of that season

- **When** I open the meal choice
- **And** I choose the "Summer" season
- **Then** the suggestion is one of "Omelette, Ratatouille"

### Choosing a course proposes a recipe of that course

- **When** I open the meal choice
- **And** I choose the "Starter" course
- **Then** the suggestion is one of "Tomato salad"

### Nothing is proposed when no recipe matches

- **When** I open the meal choice
- **And** I choose the "Winter" season
- **And** I choose the "Starter" course
- **Then** I see that no recipe matches
- **And** I cannot ask for a suggestion

### Asking again suggests another recipe

- **When** I open the meal choice
- **And** I ask for another suggestion
- **Then** the two suggestions are different

### The suggested recipe opens in full

- **When** I open the meal choice
- **And** I open the suggestion
- **Then** the suggested recipe's page opens

## Meal history

Saying "I cooked it" on a recipe's page, or "Mark as cooked" on the shopping list (offered on coming back from the share sheet), records the day; the meal choice's card shows it. The meal choice then skips the recipes cooked recently: in the last 14 days, or as chosen in Settings › Skip recent meals (Off, 7, 14 or 30 days). When every matching recipe was cooked recently, it proposes the one cooked longest ago. The history syncs with the server like the recipes, and is read-only on a TV.

### A recipe can be marked as cooked on its page

- **Given** these recipes:

  | title        | cooked |
  | ------------ | ------ |
  | Pumpkin soup | never  |

- **When** I open "Pumpkin soup"
- **And** I say I cooked it
- **Then** I see "Cooked today"
- **And** it can't be marked as cooked again today

### The suggestion shows when it was last cooked

- **Given** these recipes:

  | title        | cooked     |
  | ------------ | ---------- |
  | Pumpkin soup | 3 days ago |

- **When** I open the meal choice
- **Then** I see "Cooked 3 days ago"
- **And** the suggestion can't be marked as cooked there

### A recipe shows when it was last cooked

- **Given** these recipes:

  | title        | cooked     |
  | ------------ | ---------- |
  | Pumpkin soup | 3 days ago |

- **When** I open "Pumpkin soup"
- **Then** I see "Cooked 3 days ago"

### The last time cooked can be removed, after confirming

- **Given** these recipes:

  | title        | cooked                  |
  | ------------ | ----------------------- |
  | Pumpkin soup | 10 days ago, 3 days ago |

- **When** I open "Pumpkin soup"
- **And** I remove the last time it was cooked
- **And** I confirm the removal
- **Then** I see "Cooked 10 days ago"

### The meal choice skips the recipes cooked recently

- **Given** these recipes:

  | title        | cooked     |
  | ------------ | ---------- |
  | Pumpkin soup | 2 days ago |
  | Omelette     | never      |

- **When** I open the meal choice
- **Then** the suggestion is "Omelette"
- **When** I ask for another suggestion
- **Then** the suggestion is "Omelette"

### The recipes cooked before the last 14 days are proposed again

- **Given** these recipes:

  | title        | cooked      |
  | ------------ | ----------- |
  | Pumpkin soup | 20 days ago |
  | Omelette     | 2 days ago  |

- **When** I open the meal choice
- **Then** the suggestion is "Pumpkin soup"

### When every recipe was cooked recently, the one cooked longest ago is proposed

- **Given** these recipes:

  | title        | cooked     |
  | ------------ | ---------- |
  | Pumpkin soup | 2 days ago |
  | Omelette     | 5 days ago |

- **When** I open the meal choice
- **Then** the suggestion is "Omelette"

### Recent meals are proposed too when the setting is off

- **Given** these recipes:

  | title        | cooked     |
  | ------------ | ---------- |
  | Pumpkin soup | 2 days ago |
  | Omelette     | never      |

- **And** recent meals aren't skipped
- **When** I open the meal choice
- **And** I ask for another suggestion
- **Then** both recipes were suggested

## On a TV

On an Android TV, driven with the remote, the app is read-only: it proposes and shows recipes, which are written in the app on a phone. The ingredient list, only used to manage ingredients, and the shopping list, only used to share one, aren't in the TV's menu.

### A recipe is shown without edit or delete

- **Given** the recipe "Pumpkin soup" exists
- **When** I open "Pumpkin soup" on the TV
- **Then** I can read "Pumpkin soup"
- **And** it can't be edited or deleted

### Recipes can't be added on the TV

- **Given** there are no recipes
- **When** I open the recipe list on the TV
- **Then** I am told that recipes are written in the app on a phone, to sync with the TV
- **And** no recipe can be added

### The meal choice doesn't offer to add a recipe on the TV

- **Given** there are no recipes
- **When** I open the meal choice on the TV
- **Then** I am told that recipes are written in the app on a phone, to sync with the TV
- **And** no recipe can be added

### Links to the writing screens lead to the meal choice on the TV

- **When** I open the new recipe form on the TV
- **Then** I am taken to the meal choice
- **When** I open the ingredient list on the TV
- **Then** I am taken to the meal choice
- **When** I open the shopping list on the TV
- **Then** I am taken to the meal choice

## Recipe list

The saved recipes in alphabetical order, narrowed down by a search on the title, by season, by course and by the ingredients the recipe must contain. Synced with a server shared by several people, also by who added them.

**For every scenario:**

- **Given** these recipes:

  | title        | season | course  | ingredients           |
  | ------------ | ------ | ------- | --------------------- |
  | Pumpkin soup | winter | starter | pumpkin, onion, cream |
  | Tomato salad | summer | starter | tomato, onion         |
  | Omelette     | both   | main    | egg, cream            |

### Every recipe is listed without filters

- **When** I open the recipe list
- **Then** the list shows "Omelette, Pumpkin soup, Tomato salad"

### A season also includes the recipes for both seasons

- **When** I open the recipe list
- **And** I show the filters
- **And** I choose the "Summer" season
- **Then** I see that 2 recipes match
- **And** the list shows "Omelette, Tomato salad"

### A course keeps only the recipes of that course

- **When** I open the recipe list
- **And** I show the filters
- **And** I choose the "Main course" course
- **Then** I see that 1 recipe matches
- **And** the list shows "Omelette"

### Listed recipes contain every selected ingredient

- **When** I open the recipe list
- **And** I show the filters
- **And** I select the ingredient "onion"
- **And** I select the ingredient "cream"
- **Then** I see that 1 recipe matches
- **And** the list shows "Pumpkin soup"

### Synced with a server, "Added by: Me" keeps the recipes I added

- **Given** the phone syncs with a server where "Omelette" was added by someone else
- **When** I open the recipe list
- **And** I show the filters
- **And** I choose "Me" for who added them
- **Then** I see that 2 recipes match
- **And** the list shows "Pumpkin soup, Tomato salad"

### Without a server, every recipe is mine: there is no "Added by" filter

- **When** I open the recipe list
- **And** I show the filters
- **Then** I can't choose who added the recipes

### The title search ignores case and accents

- **When** I open the recipe list
- **And** I search for "OMÉLETTE"
- **Then** the list shows "Omelette"

### A title search can match nothing

- **When** I open the recipe list
- **And** I search for "pizza"
- **Then** I see that no recipe is titled "pizza"
- **And** the list shows ""

### The title search and the filters add up

- **When** I open the recipe list
- **And** I show the filters
- **And** I search for "o"
- **And** I choose the "Winter" season
- **Then** I see that 2 recipes match
- **And** the list shows "Omelette, Pumpkin soup"

### Nothing is listed when no recipe matches

- **When** I open the recipe list
- **And** I show the filters
- **And** I choose the "Summer" season
- **And** I select the ingredient "pumpkin"
- **Then** I see that no recipe matches
- **And** the list shows ""

### Filters are hidden at first and stay applied once hidden

- **When** I open the recipe list
- **Then** only the title search is shown
- **When** I show the filters
- **And** I choose the "Summer" season
- **And** I hide the filters
- **Then** the filters button tells that 1 filter is on
- **And** the list shows "Omelette, Tomato salad"

## Recipes

A recipe has a title, a season, ingredients and its instructions.

### A recipe is written with existing and new ingredients

- **Given** the ingredient "Pumpkin" exists
- **And** I am writing a new recipe
- **When** I give it the title "Pumpkin soup"
- **And** I choose the "Winter" season
- **And** I add the existing ingredient "Pumpkin"
- **And** I add the new ingredient "Ginger"
- **And** I save the recipe
- **Then** the recipe "Pumpkin soup" is saved for winter with "Ginger, Pumpkin"
- **And** "Ginger" is now in the ingredient list

### A recipe needs a title

- **Given** I am writing a new recipe
- **When** I save the recipe
- **Then** I am asked to give the recipe a title

### Two recipes cannot have the same title, ignoring case and accents

- **Given** the recipe "Crêpes" exists
- **And** I am writing a new recipe
- **When** I give it the title "crepes"
- **And** I save the recipe
- **Then** I am told "You already have a recipe named “Crêpes”."
- **And** there is still only "Crêpes"

### A recipe cannot have the title of a drink

- **Given** the drink "Mojito" exists
- **And** I am writing a new recipe
- **When** I give it the title "Mojito"
- **And** I save the recipe
- **Then** I am told "You already have a drink named “Mojito”."

### A recipe keeps its title when edited

- **Given** the recipe "Crêpes" exists
- **And** I am editing it
- **When** I give it the title "CRÊPES"
- **And** I save the recipe
- **Then** the recipe is saved as "Crêpes"

### A recipe written in Markdown is previewed formatted

- **Given** I am writing a new recipe
- **When** I write "**Roast** the pumpkin" as the recipe
- **And** I switch to "Preview"
- **Then** I see "Roast the pumpkin" with "Roast" in bold
- **When** I switch to "Write"
- **Then** the recipe text is still "**Roast** the pumpkin"

## Server sync

Your data (recipes and ingredients today) is kept on the phone. It can also be synced with your own server, to share it between phones: each phone keeps working without it, and catches up when it reaches it.

### Data is kept on the phone only at first

- **Given** the settings are open
- **Then** my data is kept on this phone only

### Connecting to a server merges its recipes with the phone's

- **Given** the recipe "Leek soup" on this phone
- **And** the recipe "Pancakes" on the server, from another phone
- **And** the settings are open
- **When** I connect to the server with the right account
- **Then** I am told that the phone is synced with the server
- **And** the phone has the recipes "Leek soup" and "Pancakes"
- **And** the server has the recipe "Leek soup"

### A wrong password is refused

- **Given** the settings are open
- **When** I connect to the server with a wrong password
- **Then** I am told that the email or password is wrong
- **And** the phone is not synced with the server

### An unreachable server is reported

- **Given** the phone is synced with the server
- **And** the server can't be reached
- **When** I ask for a sync
- **Then** I am told that the server doesn't answer

### A server older than the app is reported

- **Given** the phone is synced with the server
- **And** the server lacks the latest server update
- **And** the recipe "Pie" on this phone
- **When** I ask for a sync
- **Then** I am told that the server needs an update
- **And** the server doesn't have the recipe "Pie"

### An app older than the server is asked to update

- **Given** the phone is synced with the server
- **And** the server only accepts newer apps
- **When** I ask for a sync
- **Then** I am told that the app needs an update

### A server newer than the app is pointed out

- **Given** the phone is synced with the server
- **And** the server has an update this app doesn't know
- **When** I ask for a sync
- **Then** I am told that an app update exists
- **And** the phone is still synced

### Changes waiting for the server show in the header

- **Given** the phone is synced with the server
- **And** the recipe "Pie" on this phone
- **Then** the header shows 1 change to sync
- **When** I ask for a sync
- **Then** the header shows nothing about the sync

### A failed sync shows in the header, which leads to the settings

- **Given** the phone is synced with the server
- **And** the server can't be reached
- **And** the recipe "Pie" on this phone
- **When** I ask for a sync
- **Then** the header shows that the sync failed with 1 change waiting
- **When** I press the sync status in the header
- **Then** the data storage settings open

### Stopping the sync keeps the data

- **Given** the recipe "Leek soup" on this phone
- **And** the phone is synced with the server
- **When** I stop syncing with the server
- **Then** my data is kept on this phone only
- **And** the phone has the recipe "Leek soup"

## Sharing a recipe

A recipe's page shares it as a PDF (Share as PDF, at the top), through the phone's share sheet: messages, email, a drive… The PDF is made on the phone, in the reader's language and units (A4 pages, or US Letter with US units), and named after the recipe. It's a temporary file: the app deletes it on coming back from the share sheet, and deletes any leftover when it starts. There's no history of what was shared, and no import: a PDF can't come back into the app. Not on a TV.

### A recipe is shared as a PDF named after it

- **Given** the recipe "Leek soup" with 3 leeks
- **When** I open "Leek soup"
- **And** I share it as a PDF
- **Then** a PDF of "Leek soup" listing "Leek: 3" is shared
- **And** the PDF is deleted afterwards

### A PDF that can't be made is explained

- **Given** the recipe "Leek soup" with 3 leeks
- **And** PDFs can't be made
- **When** I open "Leek soup"
- **And** I share it as a PDF
- **Then** I'm told the PDF couldn't be made

## Shopping list

Meals are picked on the meal choice (the cart button, "Add to list", which proposes another recipe; a "Shopping list" button then appears at the bottom) or on a recipe. The shopping list adds up their ingredients, in the reader's units, and shares them as text with another app (notes, messages, email…). On coming back from the share sheet, it offers to mark the meals as cooked (the meal history), which empties the list: Android doesn't tell whether something was sent, so the offer also comes after closing the sheet. The list isn't saved: it's forgotten when the app closes. It holds 50 meals at most. Not on a TV.

**For every scenario:**

- **Given** these recipes:

  | title     | ingredients                    |
  | --------- | ------------------------------ |
  | Leek soup | Leek: 3, Potato: 500 g, Salt   |
  | Leek pie  | Leek: 2, Potato: 300 g, Pastry |

### The meal choice explains how to make a shopping list

- **When** I open the meal choice
- **Then** I'm told to add meals, then to share them from the list's button
- **When** I add the suggestion to the shopping list
- **Then** I'm told 1 meal is in the shopping list

### The suggestion can be added to the list, and another recipe is proposed

- **When** I open the meal choice
- **And** I add the suggestion to the shopping list
- **Then** the other recipe is suggested
- **And** the shopping list holds 1 meal

### The meal choice doesn't suggest the meals in the list

- **When** I open the meal choice
- **And** I add the suggestion to the shopping list
- **And** I ask for another suggestion
- **Then** the other recipe is suggested

### Nothing is suggested once every matching recipe is in the list

- **When** I open the meal choice
- **And** I add the suggestion to the shopping list
- **And** I add the suggestion to the shopping list
- **Then** I am told that every matching recipe is in the shopping list

### The list adds up the ingredients of its meals

- **Given** "Leek soup" and "Leek pie" are in the shopping list
- **When** I open the shopping list
- **Then** it lists "Leek: 5", "Pastry", "Potato: 800 g" and "Salt"

### Sharing the list, then marking its meals as cooked

- **Given** "Leek soup" and "Leek pie" are in the shopping list
- **When** I open the shopping list
- **And** I share it
- **Then** the shared text lists the meals and "• Potato: 800 g"
- **When** I mark the meals as cooked
- **Then** the shopping list is empty
- **And** "Leek soup" and "Leek pie" were cooked today

### A browser that can't share copies the list

- **Given** "Leek soup" and "Leek pie" are in the shopping list
- **When** I open the shopping list
- **And** I share it in a browser that can't share
- **Then** I'm told the list is copied, to paste it where I want
- **And** I'm offered to mark the meals as cooked

### Sharing that fails says so

- **Given** "Leek soup" and "Leek pie" are in the shopping list
- **When** I open the shopping list
- **And** sharing it fails
- **Then** I'm told the list couldn't be shared
- **And** I'm not offered to mark the meals as cooked

### A meal can be taken out of the list

- **Given** "Leek soup" and "Leek pie" are in the shopping list
- **When** I open the shopping list
- **And** I take "Leek pie" out of the list
- **Then** it lists "Leek: 3", "Potato: 500 g" and "Salt"

### A suggestion added to the list from its page is replaced

- **When** I open the meal choice
- **And** I open the suggestion and add it to the shopping list
- **And** I go back to the meal choice
- **Then** the other recipe is suggested

### The offer to mark the meals as cooked goes once the list changes

- **Given** "Leek soup" is in the shopping list
- **When** I open the shopping list
- **And** I share it
- **And** "Leek pie" is added to the list
- **Then** I'm not offered to mark the meals as cooked

### A recipe can be added to the list from its page

- **When** I open "Leek soup"
- **And** I add it to the shopping list
- **Then** the shopping list holds 1 meal
- **When** I take it out of the shopping list
- **Then** the shopping list is empty
