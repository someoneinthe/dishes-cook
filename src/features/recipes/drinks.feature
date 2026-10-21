Feature: Drinks
  Drinks (cocktails, smoothies, hot drinks…) are written like recipes, with their
  ingredients, times and photo, but without a season nor a course nor a cooking
  time. A drink can have a maturation time instead (a liqueur, a flavoured wine), in
  months, which can be a fraction: it shows apart from the preparation time, on the
  drink's page, its PDF and the Drinks list. Drinks have their own list, Drinks in
  the menu, with the title search and the ingredient filter; Recipes lists the
  dishes only. The meal choice only suggests dishes, and drinks
  have no meal history, but a drink can be added to the shopping list from its
  page. They sync with the server like the dishes. Read-only on a TV.

  Scenario: A drink is written without a season nor a course, and listed with the drinks only
    Given the dish "Leek soup" exists
    When I write a new drink "Mojito"
    Then the form asks for no season nor course
    When I save the drink
    Then Drinks lists "Mojito" only
    And Recipes lists "Leek soup" only

  Scenario: A drink has a preparation and a maturation time, but no cooking time
    When I write a new drink "Limoncello"
    Then the form asks for a preparation and a maturation time but no cooking time
    When I give it 20 minutes of preparation and "1.5" months of maturation
    And I save the drink
    Then the drink shows "Preparation 20 min · Maturation 1.5 months"
    And Drinks shows "Maturation 1.5 months" on its row

  Scenario: A maturation time is a number of months up to 24
    When I write a new drink "Limoncello"
    And I give it 20 minutes of preparation and "1.125" months of maturation
    And I save the drink
    Then the form says "Enter a number of months up to 24, like 0.5 or 2."

  Scenario: The meal choice never suggests a drink
    Given the drink "Mojito" exists
    Then the meal choice has no recipe to suggest

  Scenario: A drink's page has no season, no course and no meal history
    Given the drink "Mojito" exists
    When I open it
    Then it shows no season, no course and no "I cooked it"
    And it can be added to the shopping list
