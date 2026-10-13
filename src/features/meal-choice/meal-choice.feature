Feature: Meal choice
  The app suggests a random recipe among the saved ones, narrowed down by
  season, by course and by the ingredients the recipe must contain.

  Background:
    Given these recipes:
      | title         | season | course  | ingredients            |
      | Pumpkin soup  | winter |         | pumpkin, onion, cream  |
      | Tomato salad  | summer | starter | tomato, onion          |
      | Omelette      | both   | main    | egg, cream             |

  Scenario: Any recipe can be suggested without filters
    When I open the meal choice
    Then I see that 3 recipes match
    When I ask for a suggestion
    Then the suggestion is one of "Pumpkin soup, Tomato salad, Omelette"

  Scenario: A season also includes the recipes for both seasons
    When I open the meal choice
    And I choose the "Summer" season
    Then I see that 2 recipes match
    When I ask for a suggestion
    Then the suggestion is one of "Tomato salad, Omelette"

  Scenario: A course keeps only the recipes of that course
    When I open the meal choice
    And I choose the "Main course" course
    Then I see that 1 recipe matches
    When I ask for a suggestion
    Then the suggestion is one of "Omelette"

  Scenario: Suggested recipes contain every selected ingredient
    When I open the meal choice
    And I select the ingredient "onion"
    And I select the ingredient "cream"
    Then I see that 1 recipe matches
    When I ask for a suggestion
    Then the suggestion is one of "Pumpkin soup"

  Scenario: Asking again suggests another recipe
    When I open the meal choice
    And I choose the "Winter" season
    And I ask for a suggestion
    And I ask for another suggestion
    Then the two suggestions are different

  Scenario: Nothing can be suggested when no recipe matches
    When I open the meal choice
    And I choose the "Summer" season
    And I select the ingredient "pumpkin"
    Then I see that no recipe matches
    And I cannot ask for a suggestion
