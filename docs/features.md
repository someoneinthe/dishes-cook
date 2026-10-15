# Features

<!-- Generated from the behaviour specs (src/**/*.feature) by `npm run docs:features`: don't edit by hand. -->

What the app does, scenario by scenario. Every scenario runs as a test (jest-cucumber), so this page only describes behaviour that is checked.

- [Ingredient quantities](#ingredient-quantities): 3 scenarios
- [Ingredients](#ingredients): 2 scenarios
- [Loading screen](#loading-screen): 3 scenarios
- [Meal choice](#meal-choice): 7 scenarios
- [On a TV](#on-a-tv): 4 scenarios
- [Recipe list](#recipe-list): 9 scenarios
- [Recipes](#recipes): 3 scenarios
- [Server sync](#server-sync): 5 scenarios

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

At startup, the dishes illustration replaces the native splash screen, stays on screen for a moment, then fades into the app.

### The illustration replaces the native splash screen

- **Given** the app is starting
- **When** the loading screen is laid out
- **Then** the native splash screen is hidden

### The app opens once the illustration has been shown

- **Given** the app is starting
- **And** the illustration is displayed
- **When** 1900 milliseconds have passed
- **Then** the loading screen is finished

### The app still opens when the illustration fails to load

- **Given** the app is starting
- **And** the illustration fails to load
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

### The suggestion offers another one

- **When** I open the meal choice
- **And** I ask the suggestion for another one
- **Then** the two suggestions are different

### The suggested recipe opens in full

- **When** I open the meal choice
- **And** I open the suggestion
- **Then** the suggested recipe's page opens

## On a TV

On an Android TV, driven with the remote, the app is read-only: it proposes and shows recipes, which are written in the app on a phone. The ingredient list, only used to manage ingredients, isn't in the TV's menu.

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

## Recipe list

The saved recipes in alphabetical order, narrowed down by a search on the title, by season, by course and by the ingredients the recipe must contain.

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

### Stopping the sync keeps the data

- **Given** the recipe "Leek soup" on this phone
- **And** the phone is synced with the server
- **When** I stop syncing with the server
- **Then** my data is kept on this phone only
- **And** the phone has the recipe "Leek soup"
