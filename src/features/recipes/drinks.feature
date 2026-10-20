Feature: Drinks
  Drinks (cocktails, smoothies, hot drinks…) are written like recipes, with their
  ingredients, times and photo, but without a season nor a course. They have their
  own list, Drinks in the menu, with the title search and the ingredient filter;
  Recipes lists the dishes only. The meal choice only suggests dishes, and drinks
  have no meal history, but a drink can be added to the shopping list from its
  page. They sync with the server like the dishes. Read-only on a TV.

  Scenario: A drink is written without a season nor a course, and listed with the drinks only
    Given the dish "Leek soup" exists
    When I write a new drink "Mojito"
    Then the form asks for no season nor course
    When I save the drink
    Then Drinks lists "Mojito" only
    And Recipes lists "Leek soup" only

  Scenario: The meal choice never suggests a drink
    Given the drink "Mojito" exists
    Then the meal choice has no recipe to suggest

  Scenario: A drink's page has no season, no course and no meal history
    Given the drink "Mojito" exists
    When I open it
    Then it shows no season, no course and no "I cooked it"
    And it can be added to the shopping list
