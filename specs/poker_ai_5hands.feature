@vision @poker @ai
Feature: AI Poker - 5 Complete Hands
  AI plays 5 complete poker hands with DEAL AGAIN

  Scenario: AI plays 5 complete poker hands
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I scroll down
    And I scroll down
    Then I should see text "Poker Table"
    When I tap "poker_table_play_button"
    Then I should see text "DEAL"
    # AI plays 5 complete hands with DEAL AGAIN
    When AI plays poker hand 1
    And AI plays poker hand 2
    And AI plays poker hand 3
    And AI plays poker hand 4
    And AI plays poker hand 5
    Then I should see text "YOU"

