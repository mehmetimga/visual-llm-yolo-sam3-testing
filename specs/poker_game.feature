@flutter @poker
Feature: Poker Game - Flutter Mobile

  Tests Texas Hold'em poker gameplay on Flutter mobile app.
  Uses YOLO detection for Rive button identification.

  @smoke
  Scenario: Navigate to poker table and start game
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
    When I tap "deal_button"
    Then I should see text "FOLD"

  @gameplay
  Scenario: Play single poker hand
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I scroll down
    And I scroll down
    When I tap "poker_table_play_button"
    And I tap "deal_button"
    And I wait 2 seconds
    When I tap "check_button"
    And I wait 3 seconds
    Then I should see text "YOU"

  @gameplay
  Scenario: Play poker hand and fold
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I scroll down
    And I scroll down
    When I tap "poker_table_play_button"
    And I tap "deal_button"
    And I wait 2 seconds
    When I tap "fold_button"
    And I wait 2 seconds
    Then I should see text "DEAL AGAIN"

  @navigation
  Scenario: Return to lobby from poker table
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I scroll down
    And I scroll down
    When I tap "poker_table_play_button"
    Then I should see text "DEAL"
    When I tap "back_button"
    Then I should see text "Casino Lobby"
