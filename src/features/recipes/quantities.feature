Feature: Ingredient quantities
  Each ingredient of a recipe can have a quantity: an amount and a unit, or a number of pieces.
  Weights are kept in grams and volumes in millilitres, and shown in the closest unit of the
  reader's units: Settings › Units, European (the default) or US. Spoons and counted units (pinch,
  clove…) stay as written.

  Scenario: Quantities are given in the recipe form
    Given the ingredients "Carrot, Leek, Salt" exist
    And I am writing the recipe "Soup" with them
    When I give "Carrot" the quantity "0,5" in "kg"
    And I give "Leek" the quantity "2"
    And I save the recipe
    Then the recipe lists "Carrot: 500 g, Leek: 2, Salt"

  Scenario: A quantity must be a number
    Given the ingredients "Carrot" exist
    And I am writing the recipe "Soup" with them
    When I give "Carrot" the quantity "a few"
    And I save the recipe
    Then I am asked for a number like 1.5 or 1/2
    And no recipe is saved

  Scenario: A recipe written in US units is shown in my units
    Given a recipe "Cake" needs "8 oz" of "Flour" and "1 cup" of "Milk"
    When I read it with European units
    Then the recipe lists "Flour: 227 g, Milk: 237 ml"
    When I read it with US units
    Then the recipe lists "Flour: 8 oz, Milk: 1 cup"
