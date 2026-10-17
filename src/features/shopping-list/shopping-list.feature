Feature: Shopping list
  Meals are picked on the meal choice ("Add to list", which proposes another
  recipe) or on a recipe. The shopping list adds up their ingredients, in the
  reader's units, and shares them as text with another app (notes, messages,
  email…). Once shared, it offers to mark the meals as cooked (the meal
  history), which empties the list. The list isn't saved: it's forgotten when
  the app closes. It holds 50 meals at most. Not on a TV.

  Background:
    Given these recipes:
      | title     | ingredients                     |
      | Leek soup | Leek: 3, Potato: 500 g, Salt    |
      | Leek pie  | Leek: 2, Potato: 300 g, Pastry  |

  Scenario: The suggestion can be added to the list, and another recipe is proposed
    When I open the meal choice
    And I add the suggestion to the shopping list
    Then the other recipe is suggested
    And the shopping list holds 1 meal

  Scenario: The meal choice doesn't suggest the meals in the list
    When I open the meal choice
    And I add the suggestion to the shopping list
    And I ask for another suggestion
    Then the other recipe is suggested

  Scenario: Nothing is suggested once every matching recipe is in the list
    When I open the meal choice
    And I add the suggestion to the shopping list
    And I add the suggestion to the shopping list
    Then I am told that every matching recipe is in the shopping list

  Scenario: The list adds up the ingredients of its meals
    Given "Leek soup" and "Leek pie" are in the shopping list
    When I open the shopping list
    Then it lists "Leek: 5", "Pastry", "Potato: 800 g" and "Salt"

  Scenario: Sharing the list, then marking its meals as cooked
    Given "Leek soup" and "Leek pie" are in the shopping list
    When I open the shopping list
    And I share it
    Then the shared text lists the meals and "• Potato: 800 g"
    When I mark the meals as cooked
    Then the shopping list is empty
    And "Leek soup" and "Leek pie" were cooked today

  Scenario: A meal can be taken out of the list
    Given "Leek soup" and "Leek pie" are in the shopping list
    When I open the shopping list
    And I take "Leek pie" out of the list
    Then it lists "Leek: 3", "Potato: 500 g" and "Salt"

  Scenario: A suggestion added to the list from its page is replaced
    When I open the meal choice
    And the suggestion is added to the list on its page
    Then the other recipe is suggested

  Scenario: The offer to mark the meals as cooked goes once the list changes
    Given "Leek soup" is in the shopping list
    When I open the shopping list
    And I share it
    And "Leek pie" is added to the list
    Then I'm not offered to mark the meals as cooked

  Scenario: A recipe can be added to the list from its page
    When I open "Leek soup"
    And I add it to the shopping list
    Then the shopping list holds 1 meal
    When I take it out of the shopping list
    Then the shopping list is empty
