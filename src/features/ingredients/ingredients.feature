Feature: Ingredients
  Each ingredient exists once and can be shared by many recipes.

  Scenario: An ingredient is added once, whatever its case
    Given the ingredient list is open
    When I add the ingredient "Carrot"
    And I add the ingredient "carrot"
    Then I am told that "Carrot" already exists
    And the list contains only "Carrot"

  Scenario: An ingredient used by a recipe cannot be deleted
    Given the recipe "Soup" made with "Leek"
    And the ingredient list is open
    Then "Leek" is used in 1 recipe
    And "Leek" cannot be deleted
