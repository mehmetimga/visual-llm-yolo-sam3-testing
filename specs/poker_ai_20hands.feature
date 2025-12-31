Feature: AI Poker - 20 Hands Test
  Test AI playing 20 complete poker hands with YOLO detection

  @poker @ai @extended
  Scenario: AI plays 20 complete poker hands
    Given the app is running on "flutter"
    When I navigate to "/"
    And I type "testuser" into "login_username"
    And I type "password123" into "login_password"
    And I tap on "login_button"
    Then I should see text "Casino Lobby"
    When I scroll down
    And I scroll down
    Then I should see text "Poker Table"
    When I tap on "poker_table_play_button"
    Then I should see text "DEAL"
    When AI plays poker hand 1
    And AI plays poker hand 2
    And AI plays poker hand 3
    And AI plays poker hand 4
    And AI plays poker hand 5
    And AI plays poker hand 6
    And AI plays poker hand 7
    And AI plays poker hand 8
    And AI plays poker hand 9
    And AI plays poker hand 10
    And AI plays poker hand 11
    And AI plays poker hand 12
    And AI plays poker hand 13
    And AI plays poker hand 14
    And AI plays poker hand 15
    And AI plays poker hand 16
    And AI plays poker hand 17
    And AI plays poker hand 18
    And AI plays poker hand 19
    And AI plays poker hand 20
    Then I should see text "YOU"

