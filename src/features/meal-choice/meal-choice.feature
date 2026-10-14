Feature: Meal choice
  The app proposes a random recipe of the chosen season and course (a main
  course by default), and another one on request. The recipe list narrows
  recipes down by ingredients too.

  Background:
    Given these recipes:
      | title        | season | course  |
      | Pumpkin soup | winter | main    |
      | Tomato salad | summer | starter |
      | Omelette     | both   | main    |
      | Ratatouille  | summer | main    |

  Scenario: A main course is proposed as soon as the meal choice opens
    When I open the meal choice
    Then the suggestion is one of "Pumpkin soup, Omelette, Ratatouille"

  Scenario: Choosing a season proposes a recipe of that season
    When I open the meal choice
    And I choose the "Summer" season
    Then the suggestion is one of "Omelette, Ratatouille"

  Scenario: Choosing a course proposes a recipe of that course
    When I open the meal choice
    And I choose the "Starter" course
    Then the suggestion is one of "Tomato salad"

  Scenario: Nothing is proposed when no recipe matches
    When I open the meal choice
    And I choose the "Winter" season
    And I choose the "Starter" course
    Then I see that no recipe matches
    And I cannot ask for a suggestion

  Scenario: Asking again suggests another recipe
    When I open the meal choice
    And I ask for another suggestion
    Then the two suggestions are different

  Scenario: The suggestion offers another one
    When I open the meal choice
    And I ask the suggestion for another one
    Then the two suggestions are different

  Scenario: The suggested recipe opens in full
    When I open the meal choice
    And I open the suggestion
    Then the suggested recipe's page opens
