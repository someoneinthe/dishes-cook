Feature: Recipe list
  The saved recipes in alphabetical order, narrowed down by a search on the
  title, by season, by course and by the ingredients the recipe must contain.

  Background:
    Given these recipes:
      | title         | season | course  | ingredients            |
      | Pumpkin soup  | winter |         | pumpkin, onion, cream  |
      | Tomato salad  | summer | starter | tomato, onion          |
      | Omelette      | both   | main    | egg, cream             |

  Scenario: Every recipe is listed without filters
    When I open the recipe list
    Then the list shows "Omelette, Pumpkin soup, Tomato salad"

  Scenario: A season also includes the recipes for both seasons
    When I open the recipe list
    And I choose the "Summer" season
    Then I see that 2 recipes match
    And the list shows "Omelette, Tomato salad"

  Scenario: A course keeps only the recipes of that course
    When I open the recipe list
    And I choose the "Main course" course
    Then I see that 1 recipe matches
    And the list shows "Omelette"

  Scenario: Listed recipes contain every selected ingredient
    When I open the recipe list
    And I select the ingredient "onion"
    And I select the ingredient "cream"
    Then I see that 1 recipe matches
    And the list shows "Pumpkin soup"

  Scenario: The title search and the filters add up
    When I open the recipe list
    And I search for "o"
    And I choose the "Winter" season
    Then I see that 2 recipes match
    And the list shows "Omelette, Pumpkin soup"

  Scenario: Nothing is listed when no recipe matches
    When I open the recipe list
    And I choose the "Summer" season
    And I select the ingredient "pumpkin"
    Then I see that no recipe matches
    And the list shows ""
