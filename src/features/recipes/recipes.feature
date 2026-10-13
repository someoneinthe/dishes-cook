Feature: Recipes
  A recipe has a title, a season, ingredients and its instructions.

  Scenario: A recipe is written with existing and new ingredients
    Given the ingredient "Pumpkin" exists
    And I am writing a new recipe
    When I give it the title "Pumpkin soup"
    And I choose the "Winter" season
    And I add the existing ingredient "Pumpkin"
    And I add the new ingredient "Ginger"
    And I save the recipe
    Then the recipe "Pumpkin soup" is saved for winter with "Ginger, Pumpkin"
    And "Ginger" is now in the ingredient list

  Scenario: A recipe needs a title
    Given I am writing a new recipe
    When I save the recipe
    Then I am asked to give the recipe a title
