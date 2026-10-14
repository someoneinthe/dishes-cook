Feature: Meal choice
  The app proposes a random recipe among the saved ones, and another one on
  request. Narrowing the recipes down happens in the recipe list.

  Background:
    Given these recipes:
      | title        |
      | Pumpkin soup |
      | Tomato salad |
      | Omelette     |

  Scenario: A recipe is proposed as soon as the meal choice opens
    When I open the meal choice
    Then the suggestion is one of "Pumpkin soup, Tomato salad, Omelette"

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
