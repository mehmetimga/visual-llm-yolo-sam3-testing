@vision @poker @ai
Feature: AI Poker Test - 2 Hands
  Quick test of AI poker playing with 2 hands

  Scenario: AI plays 2 poker hands
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
    # AI plays 2 hands
    When AI plays poker hand 1
    And AI plays poker hand 2
    Then I should see text "YOU"

