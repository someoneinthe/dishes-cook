Feature: Meal history
  Saying "I cooked it" on a recipe's page, or "Mark as cooked" on the shopping
  list (offered on coming back from the share sheet), records the day; the
  meal choice's card shows it. The
  meal choice then skips the recipes cooked recently: in the last 14 days, or
  as chosen in Settings › Skip recent meals (Off, 7, 14 or 30 days). When every
  matching recipe was cooked recently, it proposes the one cooked longest ago.
  The history syncs with the server like the recipes, and is read-only on a TV.

  Scenario: A recipe can be marked as cooked on its page
    Given these recipes:
      | title        | cooked     |
      | Pumpkin soup | never      |
    When I open "Pumpkin soup"
    And I say I cooked it
    Then I see "Cooked today"
    And it can't be marked as cooked again today

  Scenario: The suggestion shows when it was last cooked
    Given these recipes:
      | title        | cooked     |
      | Pumpkin soup | 3 days ago |
    When I open the meal choice
    Then I see "Cooked 3 days ago"
    And the suggestion can't be marked as cooked there

  Scenario: A recipe shows when it was last cooked
    Given these recipes:
      | title        | cooked     |
      | Pumpkin soup | 3 days ago |
    When I open "Pumpkin soup"
    Then I see "Cooked 3 days ago"

  Scenario: The last time cooked can be removed, after confirming
    Given these recipes:
      | title        | cooked                  |
      | Pumpkin soup | 10 days ago, 3 days ago |
    When I open "Pumpkin soup"
    And I remove the last time it was cooked
    And I confirm the removal
    Then I see "Cooked 10 days ago"

  Scenario: The meal choice skips the recipes cooked recently
    Given these recipes:
      | title        | cooked     |
      | Pumpkin soup | 2 days ago |
      | Omelette     | never      |
    When I open the meal choice
    Then the suggestion is "Omelette"
    When I ask for another suggestion
    Then the suggestion is "Omelette"

  Scenario: The recipes cooked before the last 14 days are proposed again
    Given these recipes:
      | title        | cooked      |
      | Pumpkin soup | 20 days ago |
      | Omelette     | 2 days ago  |
    When I open the meal choice
    Then the suggestion is "Pumpkin soup"

  Scenario: When every recipe was cooked recently, the one cooked longest ago is proposed
    Given these recipes:
      | title        | cooked     |
      | Pumpkin soup | 2 days ago |
      | Omelette     | 5 days ago |
    When I open the meal choice
    Then the suggestion is "Omelette"

  Scenario: Recent meals are proposed too when the setting is off
    Given these recipes:
      | title        | cooked     |
      | Pumpkin soup | 2 days ago |
      | Omelette     | never      |
    And recent meals aren't skipped
    When I open the meal choice
    And I ask for another suggestion
    Then both recipes were suggested
